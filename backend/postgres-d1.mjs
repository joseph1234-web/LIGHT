/** Preserve the app's prepared SQLite queries while storing data in Postgres.
 * SQL comes only from the server source, never from an HTTP request. Values stay
 * bound parameters. All app tables are qualified into the private ekklo schema.
 */
export const appTables = Object.freeze([
  'activity', 'assets', 'canva_accounts', 'canva_page_rotations', 'canva_settings',
  'church_posts', 'church_settings', 'church_templates', 'connections', 'drafts',
  'jobs', 'oauth_states', 'preferences', 'provider_apps', 'runner_locks',
]);
const tables = new Set(appTables);

function tokenize(sql) {
  const tokens = []; let at = 0;
  while (at < sql.length) {
    const rest = sql.slice(at);
    const match = /^(\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|[A-Za-z_][A-Za-z_0-9]*|(?:\d+(?:\.\d*)?)|<>|!=|<=|>=|\?|.)/.exec(rest);
    if (!match) throw new Error('Unsupported SQL token.');
    const text = match[0]; at += text.length;
    tokens.push({text, kind: /^\s|^--|^\/\*/.test(text) ? 'space' : text[0] === "'" ? 'string' : /^\d/.test(text) ? 'number' : text === '?' ? 'parameter' : /^[A-Za-z_]/.test(text) ? 'word' : 'symbol'});
  }
  return tokens;
}
const meaningful = tokens => tokens.filter(t => t.kind !== 'space');
const joined = tokens => tokens.map(t => t.text).join('');
function argumentsOf(tokens) {
  const parts = [[]]; let depth = 0;
  for (const token of tokens) {
    if (token.text === '(') depth++;
    if (token.text === ')') depth--;
    if (token.text === ',' && depth === 0) parts.push([]);
    else parts.at(-1).push(token);
  }
  return parts;
}
function asJson(tokens) {
  const t = meaningful(tokens), expression = joined(tokens);
  if (t.length === 1) {
    if (t[0].kind === 'string') return `to_jsonb((${expression})::text)`;
    if (t[0].text.toUpperCase() === 'NULL') return "'null'::jsonb";
    if (t[0].jsonText) return t[0].jsonText;
  }
  return `to_jsonb((${expression}))`;
}
function rewriteFunctions(tokens) {
  const out = [];
  for (let at = 0; at < tokens.length; at++) {
    const token = tokens[at]; let open = at + 1;
    while (tokens[open]?.kind === 'space') open++;
    if (token.kind !== 'word' || tokens[open]?.text !== '(') { out.push(token); continue; }
    let depth = 1, end = open + 1;
    for (; end < tokens.length && depth; end++) {
      if (tokens[end].text === '(') depth++;
      if (tokens[end].text === ')') depth--;
    }
    if (depth) throw new Error('Unclosed SQL expression.');
    const name = token.text.toLowerCase();
    const inner = rewriteFunctions(tokens.slice(open + 1, end - 1));
    const args = argumentsOf(inner);
    let text, jsonText, scalar;
    if (name === 'json_extract') {
      if (args.length !== 2) throw new Error('Only one JSON path is supported.');
      const path = joined(args[1]).trim();
      scalar = ["'$._autopilot'", "'$.spec.imageTextVersion'"].includes(path) ? 'number' : 'text';
      text = `ekklo_private.json_extract(${args.map(joined).join(',')})`;
      if (scalar === 'number') text = `(${text})::bigint`;
      jsonText = `ekklo_private.json_value(${args.map(joined).join(',')})`;
    } else if (name === 'json_set') {
      if (args.length < 3 || args.length % 2 !== 1) throw new Error('Invalid JSON set.');
      const pairs = [];
      for (let n = 1; n < args.length; n += 2) pairs.push(`jsonb_build_array((${joined(args[n])})::text,${asJson(args[n+1])})`);
      text = `ekklo_private.json_set((${joined(args[0])})::text,${pairs.join(',')})`;
      jsonText = `(${text})::jsonb`;
    } else if (name === 'json_remove') {
      text = `ekklo_private.json_remove((${joined(args[0])})::text,${args.slice(1).map(a => `(${joined(a)})::text`).join(',')})`;
      jsonText = `(${text})::jsonb`;
    } else if (name === 'json_object') {
      text = `jsonb_build_object(${args.map(a => { const t = meaningful(a); return t.length===1 && t[0].kind==='string' ? `(${joined(a)})::text` : joined(a); }).join(',')})`;
      jsonText = text;
    } else if (name === 'json') {
      if (args.length !== 1) throw new Error('Invalid JSON cast.');
      text = `(${joined(args[0])})::jsonb`; jsonText = text;
    } else text = `${token.text}(${joined(inner)})`;
    out.push({text, kind:'computed', scalar, jsonText}); at = end - 1;
  }
  return out;
}
export function translateSql(sql, values = []) {
  const tokens = tokenize(sql); let parameter = 0;
  for (let at = 0; at < tokens.length; at++) {
    const token = tokens[at];
    if (token.kind === 'parameter') {
      const value = values[parameter]; parameter++;
      const cast = typeof value === 'number' ? (Number.isInteger(value) ? 'bigint' : 'numeric') : typeof value === 'boolean' ? 'boolean' : 'text';
      token.text = `$${parameter}::${cast}`; token.cast = cast;
    }
    if (token.kind === 'word' && /^(FROM|JOIN|UPDATE|INTO)$/i.test(token.text)) {
      let next = at + 1; while (tokens[next]?.kind === 'space') next++;
      if (tokens[next] && tables.has(tokens[next].text)) tokens[next].text = 'ekklo_private.' + tokens[next].text;
    }
    if (token.text === '`') throw new Error('Unexpected SQL quoting.');
  }
  if (parameter !== values.length) throw new Error(`SQL expected ${parameter} parameters, received ${values.length}.`);
  const rewritten = rewriteFunctions(tokens), significant = meaningful(rewritten);
  // SQLite IS/IS NOT on values includes null equality. Postgres spells it out.
  for (let at=0; at<significant.length; at++) {
    const token=significant[at];
    if (token.text.toUpperCase() !== 'IS') continue;
    const negative=significant[at+1]?.text.toUpperCase()==='NOT';
    const next=significant[at+(negative?2:1)];
    if (next?.kind==='parameter') {
      token.text=negative?'IS DISTINCT FROM':'IS NOT DISTINCT FROM';
      if(negative)significant[at+1].text='';
    }
  }
  return {sql:joined(rewritten), values};
}
export function createD1Adapter(execute, transaction) {
  function prepare(query, values=[]) {
    const executeBound=async()=>execute(translateSql(query,values));
    return {
      query, values,
      bind(...args){return prepare(query,args);},
      async all(){const r=await executeBound();return {results:r.rows,success:true,meta:{changes:r.affectedRows}};},
      async first(column){const row=(await executeBound()).rows[0]??null;return column&&row?row[column]:row;},
      async run(){const r=await executeBound();return {results:r.rows,success:true,meta:{changes:r.affectedRows}};},
    };
  }
  return {prepare,async batch(statements){return transaction(async exec=>{
    const results=[];
    for(const statement of statements){const r=await exec(translateSql(statement.query,statement.values));results.push({results:r.rows,success:true,meta:{changes:r.affectedRows}});}
    return results;
  });}};
}
