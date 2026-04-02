alter table public.sop_records
  add column if not exists counts_toward_milestone boolean not null default false,
  add column if not exists milestone_amount numeric(12,2);

update public.sop_records as record
set
  counts_toward_milestone = case
    when account.purpose = 'savings'
      and coalesce(record.amount, template.default_amount) is not null
      and coalesce(record.amount, template.default_amount) > 0
    then true
    else false
  end,
  milestone_amount = case
    when account.purpose = 'savings'
      and coalesce(record.amount, template.default_amount) is not null
      and coalesce(record.amount, template.default_amount) > 0
    then coalesce(record.amount, template.default_amount)
    else null
  end
from public.sop_templates as template
left join public.accounts as account on account.id = template.to_account_id
where record.template_id = template.id;

update public.sop_records
set
  counts_toward_milestone = false,
  milestone_amount = null
where template_id is null;

create index if not exists idx_sop_records_year_month_milestone
  on public.sop_records(year_month, counts_toward_milestone);
