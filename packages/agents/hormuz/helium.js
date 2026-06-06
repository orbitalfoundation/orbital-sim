// helium — helium supply, boiloff, and tech-sector impact model.
//
// Helium is structurally different from other commodities because:
//   1. No substitute exists (cryogenic MRI, chip fab)
//   2. It cannot be stockpiled — boils off in ~45 days in ISO containers
//   3. Qatar is ~32% of global supply; US is ~38%; Russia (12%) is sanctioned
//
// The boiloff mechanic creates a hard clock: containers stranded at Gulf ports
// begin a 45-day countdown. After that, supply is permanently destroyed — not
// deferred, destroyed. The atmosphere cannot economically recapture it.
//
// This agent tracks:
//   - Active supply from Qatar (online/offline based on LNG plant status)
//   - Stranded container inventory and boiloff countdown
//   - Effective global availability
//   - Downstream impact on semiconductor production and MRI availability
//
// bus.helium installs:
//   .availability()           — 0-1 fraction of baseline supply available
//   .stranded_containers()    — number of containers past boiloff point
//   .supply_destroyed_mmcm()  — cumulative permanent supply loss
//   .semiconductor_impact()   — 0-1 severity score for chip fab disruption
//   .mri_impact()             — 0-1 severity score for medical imaging

// Source data (see lng-and-helium.json)
const GLOBAL_SUPPLY_MMCM_PER_YEAR = 114;     // total global production
const QATAR_SHARE                  = 0.32;    // Qatar's fraction
const US_SHARE                     = 0.38;    // US fraction (cannot surge quickly)
const RUSSIA_SHARE                 = 0.12;    // Sanctioned — not available to West
const BOILOFF_DAYS                 = 45;      // Container empties in 45 days
const CONTAINER_CAPACITY_MCM       = 0.042;   // typical ISO helium container ~42,000 L

// South Korea chip fab dependency on Qatar helium
const SK_SEMICONDUCTOR_QATAR_FRACTION = 0.65;

const heliumAgent = {
  id: 'helium',

  resolve(event, bus) {
    if (event.registered) {
      this._qatar_online    = true;         // whether Qatar supply is flowing
      this._stranded_vol    = 0;            // MMcm stranded in containers
      this._destroyed_vol   = 0;            // MMcm permanently lost to boiloff
      this._days_offline    = 0;            // consecutive days Qatar supply down
      this._availability    = 1.0;

      bus.install('helium', {
        availability:           () => this._availability,
        stranded_containers:    () => Math.round(this._stranded_vol / CONTAINER_CAPACITY_MCM),
        supply_destroyed_mmcm:  () => this._destroyed_vol,
        semiconductor_impact:   () => this._semiconductorImpact(),
        mri_impact:             () => this._mriImpact(),
        days_offline:           () => this._days_offline,
      });
      return;
    }

    if (event.tick) {
      const dtDays = event.dt / 86400;
      const lng_flow = bus.flows?.rate('lng') ?? 1;

      // Qatar helium offline when LNG flow is severely disrupted
      this._qatar_online = lng_flow > 0.15;

      if (!this._qatar_online) {
        this._days_offline += dtDays;
        // Accumulate stranded volume (Qatar daily production)
        const qatar_daily_mmcm = (GLOBAL_SUPPLY_MMCM_PER_YEAR * QATAR_SHARE) / 365;
        this._stranded_vol += qatar_daily_mmcm * dtDays;
      } else {
        this._days_offline = 0;
      }

      // Boiloff: stranded containers lose their helium after 45 days
      // Model as: stranded_vol decays with time constant = 45 days
      if (this._stranded_vol > 0) {
        const boiloff = this._stranded_vol * (dtDays / BOILOFF_DAYS);
        this._stranded_vol   -= boiloff;
        this._destroyed_vol  += boiloff;
      }

      // Effective availability: Qatar supply + US supply (partial; US cannot surge > 10%)
      // Russia excluded. Australia negligible.
      const qatar_contribution = this._qatar_online
        ? QATAR_SHARE
        : Math.max(0, QATAR_SHARE - this._destroyed_vol / (GLOBAL_SUPPLY_MMCM_PER_YEAR * 0.3));
      const us_contribution     = US_SHARE * 1.05;  // slight surge from US (+5%)
      this._availability = Math.min(1, qatar_contribution + us_contribution + 0.08); // 0.08 = Algeria etc.

      console.log(
        `[helium] qatar=${this._qatar_online ? 'online' : 'OFFLINE'}` +
        `  avail=${(this._availability * 100).toFixed(0)}%` +
        `  stranded=${Math.round(this._stranded_vol / CONTAINER_CAPACITY_MCM)} containers` +
        `  destroyed=${this._destroyed_vol.toFixed(1)} MMcm`,
      );
    }
  },

  _semiconductorImpact() {
    // Impact on chip fab: South Korea most exposed (65% from Qatar)
    // Global impact weighted by major fab country exposures
    const shortage = 1 - this._availability;
    const sk_impact    = shortage * SK_SEMICONDUCTOR_QATAR_FRACTION;
    const global_impact = shortage * 0.30;  // ~30% of global chip production exposed
    return Math.min(1, (sk_impact * 0.4 + global_impact * 0.6));
  },

  _mriImpact() {
    // MRI impact follows availability with a buffer (hospitals have some on-site storage)
    // Starts biting after 30 days of shortage
    const shortage = 1 - this._availability;
    const days = this._days_offline;
    const urgency = Math.min(1, days / 30);  // ramps up over 30 days
    return Math.min(1, shortage * urgency * 1.5);
  },
};

heliumAgent.resolve.after = 'flows';
export default heliumAgent;
