CREATE SCHEMA IF NOT EXISTS ekklo_private;
REVOKE ALL ON SCHEMA ekklo_private FROM PUBLIC,anon,authenticated;
SET search_path TO ekklo_private,pg_catalog;
CREATE TABLE "activity" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"message" text NOT NULL,
	"kind" text NOT NULL,
	"created" text NOT NULL
);


CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"key" text NOT NULL,
	"filename" text NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"duration" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"hash" text NOT NULL,
	"created" text NOT NULL
);


CREATE TABLE "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"platform" text NOT NULL,
	"account_id" text NOT NULL,
	"label" text NOT NULL,
	"secret" text NOT NULL,
	"expires" text,
	"created" text NOT NULL
);


CREATE UNIQUE INDEX "connection_owner_platform" ON "connections" ("owner","platform");

CREATE TABLE "drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"payload" text NOT NULL,
	"created" text NOT NULL,
	"updated" text NOT NULL
);


CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"draft_id" text NOT NULL,
	"platform" text NOT NULL,
	"status" text NOT NULL,
	"scheduled" text NOT NULL,
	"payload" text NOT NULL,
	"remote_id" text,
	"message" text DEFAULT '' NOT NULL,
	"claimed" text,
	"created" text NOT NULL,
	"updated" text NOT NULL
);


CREATE UNIQUE INDEX "one_delivery_per_draft_platform" ON "jobs" ("owner","draft_id","platform");

CREATE TABLE "oauth_states" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"provider" text NOT NULL,
	"created" text NOT NULL,
	"verifier" text NOT NULL
);


CREATE TABLE "preferences" (
	"owner" text PRIMARY KEY NOT NULL,
	"payload" text NOT NULL,
	"updated" text NOT NULL
);

CREATE TABLE "runner_locks" (
	"owner" text PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires" bigint NOT NULL
);

CREATE TABLE "church_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"series" text NOT NULL,
	"event_id" text DEFAULT '' NOT NULL,
	"local_date" text NOT NULL,
	"scheduled" text NOT NULL,
	"payload" text NOT NULL,
	"status" text NOT NULL,
	"image_key" text,
	"remote_id" text,
	"page_id" text,
	"message" text DEFAULT '' NOT NULL,
	"claimed" text,
	"created" text NOT NULL,
	"updated" text NOT NULL
);


CREATE UNIQUE INDEX "church_post_once" ON "church_posts" ("owner","series","event_id","local_date");

CREATE TABLE "church_settings" (
	"owner" text PRIMARY KEY NOT NULL,
	"payload" text NOT NULL,
	"updated" text NOT NULL
);

CREATE TABLE "church_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"png_key" text NOT NULL,
	"pixels_key" text NOT NULL,
	"size" integer NOT NULL,
	"created" text NOT NULL
);

ALTER TABLE "church_templates" ADD "archived" integer DEFAULT 0 NOT NULL;

CREATE TABLE "provider_apps" (
	"id" text PRIMARY KEY NOT NULL,
	"owner" text NOT NULL,
	"provider" text NOT NULL,
	"secret" text NOT NULL,
	"updated" text NOT NULL
);


CREATE UNIQUE INDEX "provider_app_owner" ON "provider_apps" ("owner","provider");
CREATE TABLE "canva_accounts" (
	"owner" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"secret" text NOT NULL,
	"expires" text NOT NULL,
	"refresh_claim" text,
	"updated" text NOT NULL
);


CREATE TABLE "canva_settings" (
	"owner" text PRIMARY KEY NOT NULL,
	"payload" text NOT NULL,
	"updated" text NOT NULL
);

CREATE TABLE "canva_page_rotations" (
	"owner" text NOT NULL,
	"series" text NOT NULL,
	"event_id" text DEFAULT '' NOT NULL,
	"source_url" text NOT NULL,
	"design_id" text NOT NULL,
	"page_count" integer NOT NULL,
	"next_page" integer DEFAULT 1 NOT NULL,
	"updated" text NOT NULL
);


CREATE UNIQUE INDEX "canva_page_rotation_key" ON "canva_page_rotations" ("owner","series","event_id","source_url");
DROP INDEX "church_post_once";

CREATE UNIQUE INDEX "church_post_once" ON "church_posts" ("owner","series","event_id","local_date") WHERE "church_posts"."status" <> 'removed';

CREATE TABLE legacy_accounts (owner text PRIMARY KEY, email text UNIQUE NOT NULL);
CREATE TABLE identities (auth_user_id uuid PRIMARY KEY, owner text UNIQUE NOT NULL, email text NOT NULL);
CREATE TABLE migration_state (id boolean PRIMARY KEY DEFAULT true CHECK(id), ready boolean NOT NULL DEFAULT false, cron_enabled boolean NOT NULL DEFAULT false, phase text NOT NULL DEFAULT 'new', checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb, app_url text NOT NULL DEFAULT 'https://joseph1234-web.github.io/LIGHT/', api_base text NOT NULL DEFAULT 'https://yznhkfyctmsmkeibepsh.supabase.co/functions/v1/ekklo-api/api', updated timestamptz NOT NULL DEFAULT now());
INSERT INTO migration_state(id) VALUES(true);
CREATE TABLE migration_objects (key text PRIMARY KEY, copied boolean NOT NULL DEFAULT false, size bigint, error text);

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



ALTER TABLE ekklo_private.activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.canva_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.canva_page_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.canva_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.church_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.church_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.church_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.provider_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.runner_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.legacy_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.migration_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE ekklo_private.migration_objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA ekklo_private FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA ekklo_private FROM PUBLIC,anon,authenticated;

SET search_path TO public,pg_catalog;
