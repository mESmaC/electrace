-- Electrace activation readout
--
-- Paste these into Supabase SQL after applying 0008_usage_events.sql.
-- The activation.* events are logged once per browser, so they answer
-- "did this visitor ever reach the moment?" rather than "how many times did they click?"

-- 1) First-win funnel, last 14 days.
with sessions as (
  select distinct session
  from public.usage_events
  where created_at > now() - interval '14 days'
    and session is not null
),
milestones as (
  select
    session,
    bool_or(event = 'editor.open') as opened_editor,
    bool_or(event = 'activation.first_block') as first_block,
    bool_or(event = 'activation.first_wire') as first_wire,
    bool_or(event = 'activation.first_finding') as first_finding,
    bool_or(event = 'activation.first_clean_check') as first_clean_check,
    bool_or(event = 'activation.first_drill_in') as first_drill_in,
    bool_or(event = 'activation.first_report') as first_report,
    bool_or(event = 'activation.first_export') as first_export
  from public.usage_events
  where created_at > now() - interval '14 days'
  group by session
)
select
  count(*) as sessions,
  count(*) filter (where opened_editor) as opened_editor,
  count(*) filter (where first_block) as first_block,
  count(*) filter (where first_wire) as first_wire,
  count(*) filter (where first_finding) as first_finding,
  count(*) filter (where first_clean_check) as first_clean_check,
  count(*) filter (where first_drill_in) as first_drill_in,
  count(*) filter (where first_report) as first_report,
  count(*) filter (where first_export) as first_export
from sessions s
left join milestones m using (session);

-- 2) Daily first-win trend.
select
  date_trunc('day', created_at) as day,
  count(distinct session) filter (where event = 'editor.open') as editor_sessions,
  count(distinct session) filter (where event = 'activation.first_block') as first_block,
  count(distinct session) filter (where event = 'activation.first_wire') as first_wire,
  count(distinct session) filter (where event = 'activation.first_finding') as first_finding,
  count(distinct session) filter (where event = 'activation.first_clean_check') as first_clean_check,
  count(distinct session) filter (where event = 'activation.first_export') as first_export
from public.usage_events
where created_at > now() - interval '30 days'
group by 1
order by 1 desc;

-- 3) What checks create the first "oh, this caught something" moment?
select
  jsonb_array_elements_text(meta->'rules') as rule,
  count(*) as first_finding_sessions
from public.usage_events
where event = 'activation.first_finding'
  and created_at > now() - interval '30 days'
  and jsonb_typeof(meta->'rules') = 'array'
group by 1
order by first_finding_sessions desc;

-- 4) Which exports/reports are people reaching for?
select event, meta->>'kind' as kind, count(*) as uses
from public.usage_events
where event in ('activation.first_export', 'export.design_json', 'export.kicad_netlist', 'export.report_md')
  and created_at > now() - interval '30 days'
group by 1, 2
order by uses desc;
