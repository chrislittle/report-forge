# Pricing Estimate Guide

How to build an Azure pricing estimate through conversation: what to ask, how to get
real prices, how to do the math, and what must be true before you hand it over.

> **Every price in the report comes from the live public
> [Azure Retail Prices API](https://learn.microsoft.com/rest/api/cost-management/retail-prices/azure-retail-prices).
> Never from memory, never from a cached table, never from a model's recollection of
> what a VM costs.** Rates change; your training data is stale by definition.

---

## 1. The interview

Ask in this order. Two or three questions at a time — not one giant form. Offer a
sensible default with every question so the user can just say "yes".

> **The golden rule of the interview: ask for requirements, never for part numbers.**
> Do not ask which VM size, which disk tier, or which meter. Many users do not know
> them, and the person the estimate gets forwarded to almost certainly does not. Ask
> what the workload needs; **you** translate that into SKUs and show the translation
> for confirmation. If the user volunteers a SKU, take it and move on.

### Round 1 — what and where (always ask)

| Ask | Why it matters | Default to offer |
|---|---|---|
| **What are we pricing?** Workload in plain language | Determines which meters to pull | — |
| **Which region?** | Prices vary materially by region | Ask; never assume |
| **Currency?** | Query the API directly in it — never convert | `USD` |
| **How long does it run?** *(time-based meters only)* | 24x7 vs business hours changes everything | 730 hr/mo (continuous) |

> **Do not ask "how many hours?" until you know the meters are time-based.** Inspect
> the meters for the service first, then ask for the dimensions that actually bill.
> For serverless and consumption services, hours are meaningless — ask instead for
> executions and memory-duration (Functions, billed per `10` units with a free band),
> RU/s or serverless RUs (Cosmos, `$0.282` per `1M` RUs), input/output/cached tokens
> (Foundry and OpenAI models, per `1M`), actions and connector calls (Logic Apps),
> operations or throughput units (Event Grid, per `1M`), or vCPU-seconds (Container
> Apps). Getting this wrong is an orders-of-magnitude error, not a rounding one.

> **Currency:** query every meter directly in the requested currency
> (`currencyCode='EUR'` etc.). Never price in USD and convert — Azure's published
> rates differ from any FX rate you would apply, and Savings Plan billing currency can
> depend on the customer's agreement. Never mix currencies across components. Apply
> the percentage discount only after every list rate is in the target currency.

### Round 2 — the discount (always ask)

| Ask | Why it matters |
|---|---|
| **Does the customer have a discount off list?** What percentage? | Drives the "Your price" column |
| **What does it apply to?** First-party consumption only, or also licenses, storage, marketplace? | A discount that excludes licenses changes the AHB story |

> If there is no discount, say so explicitly in Assumptions and show list only —
> do not invent one, and do not leave a `0%` discount column that implies one exists.

### Round 3 — the shape of the estimate

| Ask | Default to offer |
|---|---|
| **One configuration, or options to compare?** | 2–3 options side by side |
| **Commitment appetite** — PAYG only, or show 1yr/3yr Reserved and Savings Plans? | Show PAYG + 1yr/3yr if compute-heavy |
| **Existing licenses** — eligible for Azure Hybrid Benefit (Windows Server, RHEL, SQL)? | Ask if any Windows/SQL/RHEL is involved |

### Round 4 — service-specific quantities

Only ask what actually drives cost for the services in scope. Always offer a default
and mark it as an assumption in the report.

| Service | Ask | Sensible default |
|---|---|---|
| Virtual machines | **Requirements, not a SKU:** vCPU and memory (or what it runs), workload shape (general purpose / memory-heavy / compute-heavy / burstable), processor constraint (Intel only / AMD fine / Arm fine), count, hours | — / general purpose / AMD fine / 1 / 730 |
| Managed disks | **Capacity, and what the disk must do** — hold data, or sustain IOPS and throughput. Count and redundancy. **Premium v2 and Ultra also bill IOPS and throughput separately** | 1 TiB, standard performance, LRS |
| Storage accounts | Tier, redundancy, capacity, transactions | Hot, LRS |
| Bandwidth | Egress GB/month | 100 GB — flag it as a guess |
| Backup | Protected instance size, retention | 30 days |
| Databases | Tier, **vCore count**, storage, backup redundancy | — |
| AKS | Node pool sizes and counts, tier (Free/Standard) | **Ask — do not default** |
| Functions / serverless | Executions, memory-duration (GB-s), plan type | — |
| AI / Foundry models | Input, output and cached tokens per month | — |
| Load balancer / gateways | SKU, rules, processed GB | Standard, 5 rules |
| Public IPs | Count, static/dynamic | Static |

> **Free and included allowances cut both ways.** Some appear in the API as a
> zero-price band at `tierMinimumUnits` 0 — Functions' first 1M executions, Event
> Grid's first 1M operations, the first 100 GB of egress — and you overcharge if you
> ignore them. Others have **no meter at all**: AKS Free cluster management simply
> does not appear, and the only AKS tier meter is Standard Uptime SLA at `$0.10/hr`.
> Defaulting AKS to Standard silently adds **$73/month** the customer may not owe.
> Confirm the tier, and do not assume promotional or free-account grants apply.

> **Unknown quantities:** ask, offer a default, and if the customer still does not
> know, use the default *and list it under Assumptions in the customer's words*
> ("egress not yet measured; modeled at 100 GB/month"). Never silently invent a number.

### Turning requirements into a shortlist

The user supplies requirements. You produce the candidate SKUs and explain them.

1. **Match the requirement** — find sizes offering the vCPU and memory in the target
   region, via `az vm list-skus -l <region> --resource-type virtualMachines` filtered
   on capabilities, or the Retail Prices API by `armSkuName`.
2. **Discard what cannot be deployed** — check regional restrictions, then check
   Microsoft Learn for capacity growth restrictions and retirement dates. A correct
   price for a series the customer cannot grow into is still a bad estimate.
3. **Shortlist one per processor family** — typically AMD, Intel, and Arm where the
   workload could take it.
4. **Explain each in the customer's language**, then confirm before pricing:

> "For 4 vCPU and 16 GiB general purpose in Central US I would price three.
> **D4as_v5 (AMD)** — the cheapest mainstream x86 option. **D4s_v5 (Intel)** — if the
> workload is validated on Intel or needs AVX-512. **D4ps_v5 (Arm)** — cheapest of the
> three, but only if your binaries are Arm-compatible. Swap any before I price them."

> **Newer is not automatically cheaper.** Verified in Central US: `D4s_v6` prices
> **above** `D4s_v5` — $0.228 against $0.217 per hour. Say so plainly rather than
> letting the reader assume the newer generation is the upgrade-and-save option. Pair
> it with lifecycle context: v5 is Extended, v6 and v7 are Current, and v3 and older
> carry capacity growth restrictions.

### Turning storage requirements into a tier

| The user says | You work out |
|---|---|
| "1 TB, nothing special" | Standard SSD, or Premium at the fitting tier — mention the cheaper option |
| "1 TB and it must be fast" | The Premium tier meeting the IOPS and throughput target, or Premium SSD v2 |
| "it must survive a datacenter failure" | ZRS — and quote the premium, it is substantial |

Then surface the two things that move the number most:

- **Tier cliffs.** Premium SSD v1 bills by provisioned tier, snapped up. 1,024 GiB is
  exactly P30; one GiB more becomes P40 and roughly doubles the line.
- **Redundancy premium.** Verified Central US: P30 ZRS `202.755` against P30 LRS
  `135.17` per month — about 50% more for the same capacity.

---

## 2. Getting real prices

### Base query

```powershell
$base = "https://prices.azure.com/api/retail/prices"
function Get-AzPrice {
  param([string]$Filter, [string]$ApiVersion = '2023-01-01-preview', [string]$Currency = 'USD')
  $url = "$base`?api-version=$ApiVersion&currencyCode='$Currency'&`$filter=" +
         [uri]::EscapeDataString($Filter)
  $all = @()
  do {
    $r = Invoke-RestMethod -Uri $url
    $all += $r.Items
    $url = $r.NextPageLink       # results are paged at 1000 — always follow
  } while ($url)
  return $all
}
```

### Build a meter inventory, not a single query

A bill is rarely one meter, and **a region filter alone will silently miss part of it.**
Some meters are regionless (`armRegionName` is an empty string) and some are literally
`Global`. OS and database licenses are the common trap: Red Hat Enterprise Linux
license meters return `armRegionName = ''`, so a region-filtered VM query prices the
compute and **silently drops the license**.

Verified example — RHEL license meters carry no region at all:

| `armRegionName` | `meterName` | Price |
|---|---|---|
| `''` | `1-4 vCPU VM Support` | `0.03` per hour |
| `''` | `8 vCPU VM BYOS License` | `0` per hour |
| `''` | `24 vCPU VM License` | `0.2592` per hour |

So for every estimate, assemble the **full component list first** — compute, OS or
database license, storage, control plane, networking, backup — and query each one
where it actually lives: the selected region, `armRegionName eq 'Global'`, and
regionless meters. Composite services are the norm, not the exception: AKS bills the
control plane under AKS and the nodes under Virtual Machines.

### De-duplicate before you price

**API rows are catalog records, not additive charges.** The same meter is commonly
returned several times under different `skuId`s or product aliases. Verified: the SQL
Database General Purpose Gen5 `vCore` meter returns twice, and `Zone Redundancy vCore`
three times, all with identical `meterId` and `retailPrice`. Hot LRS blob capacity
appears under both `Blob Storage` and `General Block Blob v2`.

Summing raw rows double- or triple-charges the customer. Pick the intended product
first, then de-duplicate on `(meterId, tierMinimumUnits, retailPrice, type)` before
doing any arithmetic.

### Price per benefit unit, then multiply by quantity

**A meter's price is per *its own* unit, which is often not "one instance".** Verified:
SQL Database General Purpose Gen5 is priced **per vCore** — `$0.18266/hr` is one vCore,
so an 8-vCore database is `0.18266 x 8 x 730` = **$1,067.14/mo**, not $133.34. The
matching reservation is also per vCore (`$867`/1yr → `867 x 8 / 12` = $578/mo).

Read `meterName` and `unitOfMeasure` to establish what one unit *is* — an instance, a
vCore, a PTU, an RU/s block, a DBU, a GB — then multiply by the quantity the customer
needs. **Never assume a quantity of 1.**

No authentication. No subscription. It is a public endpoint.

### Consumption (pay-as-you-go)

```powershell
$items = Get-AzPrice "armRegionName eq 'centralus' and armSkuName eq 'Standard_D4s_v5' and priceType eq 'Consumption'"
$items | Where-Object { $_.meterName -notmatch 'Spot|Low Priority' }
```

#### `unitOfMeasure` is NOT always "1 Hour" — read it every time

`retailPrice` is the price for **one whole `unitOfMeasure`**, and that unit varies
enormously. Across 14,369 Central US consumption meters, only 66% are `1 Hour`:

| `unitOfMeasure` | Count | What it means |
|---|---|---|
| `1 Hour` | 9,553 | Price per hour |
| `1K` / `10K` / `1M` | 2,471 | Price per **1,000 / 10,000 / 1,000,000 units** |
| `1/Month` | 518 | Price per month already — **do not multiply by 730** |
| `1 GB`, `1 GB/Month` | 847 | Price per GB |
| `1/Hour`, `1/Day`, `1 GiB/Hour`, `1 Second`, `1/Year`, `100` | rest | various |

**The general rule is `cost = quantity / unitSize x retailPrice`**, where `unitSize`
is the multiplier embedded in `unitOfMeasure` (1 for `1 Hour`, 10000 for `10K`,
1000000 for `1M`, …). Applying `x 730` blindly to a `1/Month` meter overstates it by
730x; treating a `10K` meter as per-unit overstates it by 10,000x.

Worked example — Hot LRS blob read operations in Central US price at `0.004` per
`10K`. Five million reads a month is `5,000,000 / 10,000 x 0.004` = **$2.00**, not
`5,000,000 x 0.004` = $20,000.

So: **parse `unitOfMeasure` before doing any arithmetic**, and put the unit in the
itemization's `Unit` column so the reader can check you.

#### Graduated / tiered pricing — `tierMinimumUnits`

Many meters return **multiple rows with the same `meterId`**, differing only by
`tierMinimumUnits`. These are price bands, and the cheaper bands apply only above a
volume threshold. 567 of 1,368 Bandwidth meters are tiered.

Real example — internet egress, Central US:

| `tierMinimumUnits` | Price per GB |
|---|---|
| 0 | `0` (the first 100 GB/month is free) |
| 100 | `0.087` |
| 10335 | `0.083` |
| 51295 | `0.07` |
| 153695 | `0.05` |

**Algorithm:** **first normalize the quantity into billing units** using
`unitOfMeasure` (see above), because **`tierMinimumUnits` is expressed in billing
units, not raw events.** Then sort the bands by `tierMinimumUnits` ascending and
charge each slice of the normalized quantity at the band it falls into — band *n*
covers from its own `tierMinimumUnits` up to the next band's. Do **not** price the
whole quantity at the top band's rate, and do **not** price it all at the first band's.

Getting that order wrong is a real error, not a rounding nit. Azure Functions
Standard executions use `unitOfMeasure` `10` with a free band at `0` and
`tierMinimumUnits` `100000`. For 2,000,000 executions the correct cost is
`(2,000,000 / 10 - 100,000) x 0.000002` = **$0.20**. Applying the threshold to raw
executions instead gives $0.38 — 90% too high.

If you take a single row from a tiered meter without noticing, the estimate is wrong
in both directions: too high for small volumes (you missed the free tier) and too
high for large ones (you missed the volume discount). Always check whether the
meter returned more than one `tierMinimumUnits` value.

#### Then convert to monthly

Once you have a correct per-unit cost: for time-based meters **monthly = hourly x 730**
(or the real hours if the workload is not 24x7). For `1/Month` meters the figure is
already monthly. For quantity meters, multiply by the monthly quantity.

### Reservations — read this carefully

```powershell
Get-AzPrice "armRegionName eq 'centralus' and armSkuName eq 'Standard_D4s_v5' and priceType eq 'Reservation'"
```

| Field | Value | Meaning |
|---|---|---|
| `reservationTerm` | `1 Month`, `1 Year`, `3 Years`, `5 Years`, `10 Years` | The term — **more than just 1 and 3 years** |
| `retailPrice` | e.g. `992.00` / `1867.00` | **TOTAL for the entire term, per reservation unit — not hourly** |
| `unitOfMeasure` | `1 Hour` | **Wrong/misleading. Ignore it.** |

**Formula:** parse `reservationTerm` into months (`1 Month` = 1, `1 Year` = 12,
`3 Years` = 36, `5 Years` = 60, `10 Years` = 120), then

```
monthly = retailPrice x reservationUnitsRequired / termMonths
```

**`reservationUnitsRequired` is not always 1** — see "Price per benefit unit" above.
A VM reservation is per instance, but SQL Database is per vCore, Cosmos DB per
100 RU/s block, Databricks per DBCU block, Foundry per PTU. Getting this wrong
understates the commitment by the unit count (8x for an 8-vCore database).

Worked example (D4s v5, Central US, 1 instance, verified 2026-09-29):

- PAYG: `0.217 x 730` = **$158.41/mo**
- 1yr RI: `992.00 x 1 / 12` = **$82.67/mo** → 47.8% below PAYG
- 3yr RI: `1867.00 x 1 / 36` = **$51.86/mo** → 67.3% below PAYG

> **Instance Size Flexibility.** Do not claim a reservation is locked to one exact
> size. Many reservations flex across sizes within a family using normalized-unit
> ratios. The Retail Prices API does not expose those ratios — get them from the
> Reservations Catalog API, or say nothing about exact-size locking.

### Savings Plans — requires the preview api-version

`savingsPlan` data is **only returned when you pass `api-version=2023-01-01-preview`**.
With the default api-version the array is absent entirely.

```powershell
$i = Get-AzPrice "armRegionName eq 'centralus' and armSkuName eq 'Standard_D4s_v5' and priceType eq 'Consumption'" -ApiVersion '2023-01-01-preview'
$i | Where-Object { $_.meterName -eq 'D4s v5' } | ForEach-Object { $_.savingsPlan }
```

Returns `{ term, unitPrice, retailPrice }` where `unitPrice` is the effective hourly
rate **per benefit unit** (unlike reservations, which give a whole-term total).
Verified for D4s v5 / Central US:

| Term | Effective /hr | Monthly (x730) |
|---|---|---|
| 1 Year | `0.131502` | $95.99 |
| 3 Years | `0.088319` | $64.47 |

**Three rules that stop this going wrong:**

1. **Only offer a Savings Plan where the meter actually has `savingsPlan` data.**
   Verified present for VMs, App Service, Functions, Container Apps/Instances, SQL
   Database/MI, Cosmos DB, PostgreSQL, MySQL, Cassandra and Spring Apps — and
   **absent** for Storage, Bandwidth and the AKS control plane. There are separate
   **compute** and **database** savings plans; say which one applies.
2. **The commitment is billed every hour of the term, whether or not the workload
   runs.** So the cost of a savings plan is `hourly commitment x every hour`, *not*
   `rate x workload runtime`. For a business-hours-only workload (160 hr/mo), a
   `$0.131502/hr` commitment still costs **$95.99/mo**, not $21.04. Only model a
   savings plan for workloads that genuinely run continuously — or model covered
   usage, unused commitment and pay-as-you-go overflow as three separate lines.
3. **Multiply by the benefit-unit quantity** — the same per-vCore/per-instance rule
   as reservations.

> Savings Plans commit to an **hourly spend amount** and flex across sizes, families and
> regions. Reservations lock to a **service and region** (with size flexibility inside a
> family) but usually discount more. State that trade-off whenever you show both.

### Azure Hybrid Benefit

AHB is not a discount code — it is a different meter. The Windows meter bundles the
license; the base meter does not. Verified for D4s v5 / Central US:

| Meter | `productName` | Rate/hr |
|---|---|---|
| Windows | `Virtual Machines Dsv5 Series Windows` | `0.401` |
| Base (Linux / AHB) | `Virtual Machines Dsv5 Series` | `0.217` |
| **License component** | difference | **`0.184`** |

So **for Windows Server on VMs, the AHB price is simply the non-Windows meter**. Model
it as: "Windows PAYG $0.401/hr → with AHB $0.217/hr, saving $0.184/hr ($134/mo)."

> **That shortcut is VM-and-Windows-Server-only. Do not generalize it.**
>
> - **SQL Database / Managed Instance (PaaS)** has no Windows-vs-Linux meter split at
>   all. AHB there is a license mode (`BasePrice` vs `LicenseIncluded`) with
>   entitlement ratios, not a different regional meter.
> - **RHEL and SUSE** bill the license as a **separate, regionless meter** alongside
>   regional VM compute — there are distinct PAYG and zero-price BYOS license meters
>   (verified: `8 vCPU VM BYOS License` = `0`). Filtering on `productName -notmatch
>   'Windows'` does not remove a RHEL license, so PAYG and BYOS would look identical
>   and you would understate the PAYG case.
>
> If the API data cannot unambiguously distinguish both license modes for the service
> in question, **say AHB could not be priced from public data** rather than inferring it.

Always confirm the customer actually holds licenses with Software Assurance before
showing AHB as the recommended number. See
[Azure Hybrid Benefit](https://learn.microsoft.com/azure/virtual-machines/windows/hybrid-use-benefit-licensing).

### Filtering traps

| Trap | Guard |
|---|---|
| Spot / Low Priority meters come back in the same query | `meterName -notmatch 'Spot|Low Priority'` |
| Windows meters returned when pricing Linux | `productName -notmatch 'Windows'` |
| Dev/Test meters | check `type` and `productName` |
| Results paged at 1000 | follow `NextPageLink` until null |
| **Reading a price off `Format-Table`** | PowerShell rounds for display — `0.217` renders as `0.22`. Always read the raw property, never a formatted table |

---

## 3. The math

1. **Establish the billing unit before anything else.** Parse `unitOfMeasure` for the
   multiplier, and `meterName` for what one unit is (instance, vCore, GB, 1M tokens).
   `cost = quantity / unitSize x retailPrice x unitsRequired`.
2. **Monthly hours = 730** for time-based meters. State it. If the workload is not
   24x7, use the real number — but remember a Savings Plan commitment is billed for
   every hour regardless.
3. **Use full precision for unit rates.** `$0.115200`, not `$0.12`. Rounding a unit
   rate once introduced a $3.50/month error on a real estimate.
4. **Round each line to 2dp, then sum the rounded values.** Do not sum at full
   precision and round the total — a reader adding up the column on the page must
   get exactly the number you printed.
5. **Discounted = list x (1 - discount).** Apply it per line, not to the grand total.
6. **Show list and discounted side by side.** Never quote discounted alone; never
   quote list alone when a discount exists.
7. **Disks bill by provisioned tier**, snapped up (a 1.2 TiB disk bills as P40 2 TiB).
   **Premium SSD v2 and Ultra are different** — they bill provisioned GiB **plus**
   provisioned IOPS **plus** provisioned throughput, each as its own meter.

---

## 4. Grounding in Microsoft documentation

Prices come from the API. *Everything else* — whether a SKU is available in the
region, whether it is capacity-restricted or retiring, what redundancy options exist,
whether a feature is in preview — comes from Microsoft Learn, checked at build time.

Use the Microsoft Learn documentation tools if the agent has them; otherwise fetch the
Learn page directly. Things worth checking before recommending a SKU:

- Is it **available in that region**? Regional availability is not implied by the API
  returning a price.
- Is it **capacity-restricted or retiring**? Recommending a series a customer cannot
  grow into is a bad estimate even if the price is right.
- Does the **redundancy option exist there**? Zone-redundant variants need availability
  zones; geo-redundant needs a paired region.

Never determine service or region availability from a single subscription's resource
provider list alone. Cross-check against the per-service Learn doc.

---

## 5. Report structure

Front half for the decision maker, back half for whoever checks the math.

| Section | Contents |
|---|---|
| Verdict banner | "This is an estimate, not a quote" + date rates were captured |
| 1. Options at a glance | Up to 3–4 cards. `win` = lowest cost (green), `muted` = special case (dashed) |
| 2. Before you compare | Warn callout for counter-intuitive behavior. Omit if nothing surprising |
| 3. How to choose | Option / key spec / price / when to choose it |
| 4. What drives the cost | Component breakdown with percentage share |
| 5. The decision that matters more | The secondary choice that moves the number most |
| 6. Commitment options | PAYG vs SP vs RI, same basis. Only if asked |
| 7. Assumptions | Hours, rates + capture date, discount scope, redundancy, what is *not* modeled |
| 8. Next steps | Numbered questions back to the customer |
| *divider* | |
| Full itemization | Every meter: Service, Description, Qty, Unit, Unit price, List, Your price |

Use `rowClasses` for `grp` (group header), `sub` (subtotal), `tot` (monthly total,
green), `win`, `muted`. Right-align every numeric column via `align`.

---

## 6. Rules

1. **Always show List and Your price side by side.**
2. **Displayed line items must sum to the displayed total.**
3. **Pull every unit price live from the API.** Never from memory.
4. **Compare like for like.** Do not compare a constrained-core size against an
   unconstrained one, or different vCPU counts, without saying so. Add a third
   option rather than conflating two.
5. **State what the discount applies to.**
6. **American spelling** — license, behavior, organization, itemization, catalog, gray.
7. **No speculation about customer intent.** State what is measured.
8. **Every external link must return 200.**
9. **It is an estimate, not a quote.** Say so on the page, every time.

---

## 7. Validation before issuing

The engine link-checks automatically. Run the rest against the generated file:

```powershell
$f = "estimate.html"; $c = Get-Content $f -Raw
# unbalanced tags
foreach ($t in 'table','tbody','thead','div','ul','ol','tr','h2','p') {
  $o = [regex]::Matches($c, "<$t[ >]").Count
  $x = [regex]::Matches($c, "</$t>").Count
  if ($o -ne $x) { "UNBALANCED $t $o/$x" } }
# British spellings
[regex]::Matches($c, 'itemis|licence|organis|behaviour|catalogue|\bgrey\b|analys|optimis|centre').Count
# leftover template tokens
[regex]::Matches($c, '\{\{[A-Z_]+\}\}|WORKLOAD|REGION_CODE|YYYY-MM-DD').Count
```

All must return zero. Then check the arithmetic by hand: **add the itemization column
and confirm it equals the printed total.** If it does not, fix the rounding order
(round each line first, then sum) — do not adjust the total.
