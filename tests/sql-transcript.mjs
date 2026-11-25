export function traceDatabase(database, transcript) {
  function record(query, method, args, fn) {
    try {const result=fn();const alternatives=method==='get'&&/^\s*SELECT\b/i.test(query)&&!/\bORDER BY\b/i.test(query)?database.prepare(query).all(...args):undefined;transcript.push({query,method,args,result:method==='exec'?null:result,alternatives});return result;}
    catch(error){transcript.push({query,method,args,error:true});throw error;}
  }
  return new Proxy(database,{get(target,key){
    if(key==='exec')return query=>record(query,'exec',[],()=>target.exec(query));
    if(key==='prepare')return query=>{
      const statement=target.prepare(query);
      return new Proxy(statement,{get(stmt,method){
        if(['get','all','run'].includes(method))return (...args)=>record(query,method,args,()=>stmt[method](...args));
        const value=Reflect.get(stmt,method,stmt);return typeof value==='function'?value.bind(stmt):value;
      }});
    };
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
}
