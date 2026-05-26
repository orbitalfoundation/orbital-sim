const agent = {
  type: "consumer",

  step({ dt, random, self, view }) {
    const demand = self.params.demandPerDay || 5;
    const maxPrice = self.params.maxPrice || 15;
    const cash = self.state.cash || 1000;
    const holdings = self.state.holdings || 0;

    const nearby = view.neighbors(2).filter((n) => n.type === "producer");
    if (nearby.length === 0) {
      return { patch: { holdings } };
    }

    const cheapest = nearby.reduce((a, b) => (a.state.price < b.state.price ? a : b));
    const price = cheapest.state.price || 10;

    let nextCash = cash;
    let nextHoldings = holdings;

    if (price <= maxPrice && cash >= price && random() < 0.5) {
      const purchase = Math.min(demand, Math.floor(cash / price));
      nextCash -= purchase * price;
      nextHoldings += purchase;
    }

    const consume = Math.min(nextHoldings, demand * 0.5);
    nextHoldings = Math.max(0, nextHoldings - consume);

    return {
      patch: {
        cash: nextCash,
        holdings: nextHoldings
      }
    };
  }
};

export default agent;
