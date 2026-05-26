const agent = {
  type: "refinery",

  step({ dt, random, self, view }) {
    const reserves = Math.max(0, (self.state.reserves || 1000) - self.params.depletionRate * dt);
    const capacity = self.params.baseCapacity || 100;
    const output = Math.min(capacity, (self.state.output || 50) + random() * 10 - 5);

    return {
      patch: {
        reserves,
        output: Math.max(0, output)
      }
    };
  }
};

export default agent;
