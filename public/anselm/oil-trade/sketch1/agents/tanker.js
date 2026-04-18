const agent = {
  type: "tanker",

  step({ dt, random, self, view }) {
    const speed = self.params.speed || 20;
    const miles = (self.state.miles || 0) + speed * dt;
    const cargo = self.state.cargo || 0;

    const dx = (random() - 0.5) * speed * dt;
    const dy = (random() - 0.5) * speed * dt;

    return {
      patch: {
        miles
      },
      position: {
        x: (self.position?.x || 0) + dx,
        y: (self.position?.y || 0) + dy
      }
    };
  }
};

export default agent;
