import { useNavigate } from "react-router-dom";
import ParticleBackground from "@/components/ParticleBackground";
import { Button } from "@/components/ui/button";
import { Construction, Home } from "lucide-react";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      <ParticleBackground />

      <div className="relative z-10 text-center px-4">
        <div className="mb-8">
          <Construction className="w-24 h-24 mx-auto text-sol-orange mb-6 animate-pulse" />
          <h1 className="text-6xl md:text-8xl font-black mb-4 gradient-text">404</h1>
          <h2 className="text-2xl md:text-4xl font-bold mb-4 text-foreground">Page Not Found</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-md mx-auto">
            This page is under construction. Check back soon!
          </p>
        </div>

        <Button
          variant="hero"
          size="lg"
          onClick={() => navigate('/')}
          className="rounded-full flex items-center gap-2 mx-auto"
        >
          <Home className="w-5 h-5" />
          Return to Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
