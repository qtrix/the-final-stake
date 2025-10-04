export default function Gameplay() {
  const gameplayData = [
    {
      number: 1,
      name: "Resource Gathering",
      description:
        "Collect resources, form alliances, and build your strategy",
    },
    {
      number: 2,
      name: "Player Battles",
      description: "Engage in strategic PvP combat and eliminate opponents",
    },
    {
      number: 3,
      name: "The Purge",
      description:
        "Final showdown where only one survivor claims victory",
    },
  ];

  return (
    <section id="gameplay" className="py-16 lg:py-24 relative">
      {/* Section Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-sol-purple/5 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-black text-center mb-16">
          <span className="gradient-text">How It Works</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
          {gameplayData.map((phase, index) => (
            <div
              key={index}
              className="text-center p-8 rounded-2xl 
                         bg-gradient-to-br from-sol-purple/20 to-sol-orange/10 
                         border border-sol-orange/30 
                         hover:border-sol-orange hover:scale-105 
                         transition-all duration-300 group"
            >
              <div className="text-6xl font-black text-primary mb-4 
                            drop-shadow-lg group-hover:scale-110 transition-transform duration-300">
                {phase.number}
              </div>
              <div className="text-xl font-bold mb-4 text-secondary">
                {phase.name}
              </div>
              <p className="text-muted-foreground leading-relaxed">
                {phase.description}
              </p>
            </div>
          ))}
        </div>

        {/* Additional Call to Action */}
        <div className="text-center mt-16">
          <p className="text-lg text-muted-foreground mb-6">
            Ready to dominate the arena?
          </p>
          <div className="inline-flex items-center gap-2 text-secondary font-semibold">
            <span>🎯</span>
            <span>Strategic gameplay meets blockchain rewards</span>
          </div>
        </div>
      </div>
    </section>
  );
}
