const agent = {
  type: "person",

  onEvents({ self, inbox }) {
    let rainfallShock = 0;
    for (const event of inbox) {
      if (event.type === "rainfall-shock") {
        rainfallShock += Number(event?.payload?.intensity || 0);
      }
    }

    if (rainfallShock === 0) {
      return null;
    }

    const healthLoss = Math.min(0.2, rainfallShock * 0.03);
    const nextHealth = Math.max(0, (self.state.health || 1) - healthLoss);

    return {
      patch: {
        health: nextHealth
      }
    };
  },

  step({ dt, random, self, view }) {
    const ageYears = (self.state.ageYears || 0) + dt / 365;
    const health = Math.max(0, Math.min(1, self.state.health || 1));

    const nearbyGoats = view.neighbors(2.5).filter((n) => n.type === "goat").length;
    const socialBuffer = nearbyGoats > 0 ? 0.0005 : 0;
    const healthDrift = -0.0007 + socialBuffer;
    const nextHealth = Math.max(0, Math.min(1, health + healthDrift));

    const maxAge = self.params.maxAge || 90;
    const agePressure = Math.max(0, ageYears - 45) / 45;
    const deathRisk = Math.max(0, Math.min(1, agePressure * (self.params.deathRiskScale || 0.01) + (1 - nextHealth) * 0.015));

    let despawn = false;
    if (ageYears >= maxAge || random() < deathRisk) {
      despawn = true;
    }

    const spawns = [];
    const birthProbabilityPerTick = (self.params.birthProbabilityPerYear || 0) / 365;
    if (!despawn && ageYears > 18 && ageYears < 45 && random() < birthProbabilityPerTick) {
      const childId = `${self.id}-child-${Math.floor(random() * 1e8)}`;
      spawns.push({
        id: childId,
        agentType: "person",
        state: {
          ageYears: 0,
          health: 0.95
        },
        params: {
          ...self.params
        },
        position: {
          x: (self.position?.x || 0) + (random() - 0.5) * 0.4,
          y: (self.position?.y || 0) + (random() - 0.5) * 0.4
        },
        tags: self.tags || []
      });
    }

    return {
      patch: {
        ageYears,
        health: nextHealth
      },
      spawns,
      despawn
    };
  }
};

export default agent;
