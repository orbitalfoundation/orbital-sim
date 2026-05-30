const agent = {
  type: "producer",

  step({ dt, random, self }) {
    const production = self.params.production || 5;
    const nextInventory = (self.state.inventory || 100) + production - random() * 3;
    const demandSignal = random() * 20;
    const nextPrice = Math.max(
      self.params.costPerUnit || 3,
      10 - nextInventory / 100 + demandSignal / 20
    );

    return {
      patch: {
        inventory: Math.max(0, nextInventory),
        price: nextPrice
      }
    };
  }
};

export default agent;
