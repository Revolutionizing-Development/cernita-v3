-- Cernita Supabase Schema
-- Run this in the Supabase SQL editor for your project.

-- ─── Trigger function for updated_at ──────────────────────────────────────────

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─── cernita_entries ──────────────────────────────────────────────────────────

create table if not exists cernita_entries (
  id                        bigserial primary key,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  -- Identity
  user_id                   uuid references auth.users(id) on delete cascade,
  user_name                 text not null,

  -- Item names (bilingual)
  item_name                 text not null,
  item_name_it              text,

  -- Decision
  final_decision            text not null check (
                              final_decision in (
                                'KEEP-ITALY', 'KEEP-TEXAS', 'SELL',
                                'DONATE', 'DISPOSE', 'GIVE-FAMILY', 'NEEDS-HUMAN'
                              )
                            ),
  user_confirmed            boolean not null default false,
  override_reason           text,

  -- Economics
  estimated_resale_value    numeric(10,2),
  replacement_cost          numeric(10,2),
  weight_lb                 numeric(8,2),
  volume_cuft               numeric(8,3),
  storage_cost_total        numeric(10,2),
  ship_cost                 numeric(10,2),
  carry_bag_cost            numeric(10,2),
  net_cost_ship             numeric(10,2),
  net_cost_storage          numeric(10,2),

  -- AI rationale (bilingual)
  recommendation_rationale    text,
  recommendation_rationale_it text,
  confidence                  text check (confidence in ('high', 'medium', 'low')),

  -- Rules provenance
  rules_version             text,
  rules_snapshot            jsonb,

  -- Preservation
  fragility                 text check (
                              fragility in ('none', 'low', 'medium', 'high', 'irreplaceable')
                            ),
  survival_risk             text,
  survival_risk_it          text,
  packing_notes             text,
  packing_notes_it          text,

  -- Media
  photo_data                text,  -- base64 data URI

  -- Location / logistics (Spec 006, 007)
  bin_id                    text,
  box_id                    bigint,
  current_location_id       bigint
);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

create trigger cernita_entries_updated_at
  before update on cernita_entries
  for each row execute procedure set_updated_at();

-- ─── Index ────────────────────────────────────────────────────────────────────

create index if not exists cernita_entries_created_at_idx
  on cernita_entries (created_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table cernita_entries enable row level security;

-- Household members (authenticated users sharing the same Supabase project)
-- can read and write all entries. This is intentional: Cernita is a shared
-- household tool, not a per-user-private data store.
create policy "authenticated_access" on cernita_entries
  for all
  to authenticated
  using (true)
  with check (true);
