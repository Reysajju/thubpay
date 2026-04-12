alter table brands
add column if not exists public_slug text unique;

update brands
set public_slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
where public_slug is null;
