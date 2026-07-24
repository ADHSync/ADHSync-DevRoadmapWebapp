create or replace function next_publication_version(content_type text)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    case content_type
        when 'roadmap' then
            return nextval('public.roadmap_version_seq');
        when 'changelog' then
            return nextval('public.changelog_version_seq');
        else
            raise exception 'Unsupported publication content type: %', content_type;
    end case;
end;
$$;

revoke all on function next_publication_version(text) from public;
revoke all on function next_publication_version(text) from anon;
revoke all on function next_publication_version(text) from authenticated;
grant execute on function next_publication_version(text) to service_role;
