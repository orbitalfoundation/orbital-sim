const agent = {
  type: "goat",

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

    const nextEnergy = Math.max(0, (self.state.energy || 0.5) - Math.min(0.25, rainfallShock * 0.05));
    return {
      patch: {
        energy: nextEnergy
      }
    };
  },

  step({ dt, random, self }) {
    const ageYears = (self.state.ageYears || 0) + dt / 365;
    const movementRadius = self.params.movementRadius || 1;
    const nextX = (self.position?.x || 0) + (random() - 0.5) * movementRadius;
    const nextY = (self.position?.y || 0) + (random() - 0.5) * movementRadius;

    const grazing = 0.01 + random() * 0.01;
    const burn = 0.008;
    const nextEnergy = Math.max(0, Math.min(1, (self.state.energy || 0.6) + grazing - burn));

    const oldAge = ageYears >= (self.params.maxAge || 16);
    const starvation = nextEnergy < 0.1 && random() < 0.2;

    return {
      patch: {
        ageYears,
        energy: nextEnergy
      },
      position: {
        x: nextX,
        y: nextY
      },
      despawn: oldAge || starvation
    };
  }
};

export default agent;
