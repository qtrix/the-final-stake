import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Gameplay from '@/components/Gameplay';
import Footer from '@/components/Footer';
import ParticleBackground from '@/components/ParticleBackground';

const Index = () => {
  return (
    <div className="min-h-screen relative">
      <ParticleBackground />
      <Navbar />
      <main className="relative z-10">
        <Hero />
        <Features />
        <Gameplay />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
