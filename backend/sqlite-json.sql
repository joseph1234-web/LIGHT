CREATE OR REPLACE FUNCTION ekklo_private.json_path(path text)
RETURNS text[] LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog
AS $$ DECLARE parts text[]:='{}'; at integer:=2; start_at integer; size integer:=length(path); segment text; escaped boolean;
BEGIN
 IF left(path,1)<>'$' THEN RAISE EXCEPTION 'Invalid JSON path'; END IF;
 WHILE at<=size LOOP
  IF substring(path from at for 1)='[' THEN
   at:=at+1;start_at:=at;
   WHILE at<=size AND substring(path from at for 1)<>']' LOOP at:=at+1; END LOOP;
   segment:=substring(path from start_at for at-start_at);
   IF at>size OR segment !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Unsupported array path'; END IF;
   parts:=array_append(parts,segment);at:=at+1;CONTINUE;
  END IF;
  IF substring(path from at for 1)<>'.' THEN RAISE EXCEPTION 'Invalid JSON path separator'; END IF;
  at:=at+1;
  start_at:=at;
  IF substring(path from at for 1)='"' THEN
   at:=at+1; escaped:=false;
   WHILE at<=size LOOP
    IF substring(path from at for 1)='"' AND NOT escaped THEN EXIT; END IF;
    IF substring(path from at for 1)=chr(92) AND NOT escaped THEN escaped:=true; ELSE escaped:=false; END IF;
    at:=at+1;
   END LOOP;
   IF at>size THEN RAISE EXCEPTION 'Unclosed JSON path key'; END IF;
   segment:=substring(path from start_at for at-start_at+1)::jsonb #>> '{}';at:=at+1;
  ELSE
   WHILE at<=size AND substring(path from at for 1) NOT IN ('.','[') LOOP at:=at+1; END LOOP;
   segment:=substring(path from start_at for at-start_at);
  END IF;
  parts:=array_append(parts,segment);
 END LOOP;
 RETURN parts;
END; $$;

CREATE OR REPLACE FUNCTION ekklo_private.json_value(document text, path text)
RETURNS jsonb LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog
AS $$ SELECT document::jsonb #> ekklo_private.json_path(path); $$;

CREATE OR REPLACE FUNCTION ekklo_private.json_extract(document text, path text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog
AS $$ SELECT CASE jsonb_typeof(value)
 WHEN 'null' THEN NULL WHEN 'boolean' THEN CASE WHEN value='true'::jsonb THEN '1' ELSE '0' END
 WHEN 'string' THEN value #>> '{}' ELSE value::text END
 FROM (SELECT ekklo_private.json_value(document,path) AS value) x; $$;

CREATE OR REPLACE FUNCTION ekklo_private.json_set(document text, VARIADIC pairs jsonb[])
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog
AS $$ DECLARE result jsonb:=document::jsonb; pair jsonb; parts text[]; n integer; prefix text[];
BEGIN
 FOREACH pair IN ARRAY pairs LOOP
  IF jsonb_typeof(pair)<>'array' OR jsonb_array_length(pair)<>2 OR left(pair->>0,2)<>'$.' THEN RAISE EXCEPTION 'Invalid JSON path'; END IF;
  parts:=ekklo_private.json_path(pair->>0);
  IF array_length(parts,1)>1 THEN
   FOR n IN 1..array_length(parts,1)-1 LOOP
    prefix:=parts[1:n];
    IF result #> prefix IS NULL THEN result:=jsonb_set(result,prefix,'{}'::jsonb,true);
    ELSIF jsonb_typeof(result #> prefix) NOT IN ('object','array') THEN parts:=NULL;EXIT; END IF;
   END LOOP;
  END IF;
  IF parts IS NOT NULL THEN result:=jsonb_set(result,parts,pair->1,true); END IF;
 END LOOP;
 RETURN result::text;
END; $$;

CREATE OR REPLACE FUNCTION ekklo_private.json_remove(document text, VARIADIC paths text[])
RETURNS text LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = pg_catalog
AS $$ DECLARE result jsonb:=document::jsonb; path text;
BEGIN FOREACH path IN ARRAY paths LOOP result:=result #- ekklo_private.json_path(path); END LOOP; RETURN result::text; END; $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ekklo_private FROM PUBLIC, anon, authenticated;
