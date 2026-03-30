import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { BarChart3, BookOpen, Calendar, CheckSquare, Crown, Send, Sparkles, Wand2, Users, ArrowRight, Star } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

const features = [
  { icon: Wand2, title: "AI Content Generator", desc: "Create captions, scripts, hashtags & ideas tailored to 7 audience niches" },
  { icon: CheckSquare, title: "Approval Workflow", desc: "Team members create, admins review and approve before publishing" },
  { icon: Calendar, title: "Content Calendar", desc: "Schedule and automate posts across Facebook, Instagram & TikTok" },
  { icon: BookOpen, title: "Content Library", desc: "Save, organise and reuse approved templates and posts" },
  { icon: Send, title: "Multi-Platform Publishing", desc: "Publish to Facebook, Instagram and TikTok with platform-specific formatting" },
  { icon: BarChart3, title: "Analytics Dashboard", desc: "Track performance, team activity and posting frequency" },
];

const niches = [
  { emoji: "⏰", label: "Time Freedom", color: "oklch(0.65 0.15 200)" },
  { emoji: "👨‍👩‍👧", label: "Busy Parents", color: "oklch(0.70 0.14 160)" },
  { emoji: "💼", label: "Side Hustlers", color: "oklch(0.78 0.12 80)" },
  { emoji: "🎓", label: "Online Business", color: "oklch(0.72 0.16 300)" },
  { emoji: "🌍", label: "Cultural Reach", color: "oklch(0.68 0.18 30)" },
  { emoji: "🌟", label: "Over 50s", color: "oklch(0.65 0.12 240)" },
  { emoji: "🛡️", label: "Scam Survivors", color: "oklch(0.55 0.20 25)" },
];

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && user) {
      setLocation("/dashboard");
    }
  }, [user, loading, setLocation]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full opacity-20"
          style={{ background: "radial-gradient(ellipse, oklch(0.78 0.12 80 / 0.3) 0%, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full opacity-10"
          style={{ background: "radial-gradient(ellipse, oklch(0.65 0.15 200 / 0.3) 0%, transparent 70%)" }}
        />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-border/30 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-4.5 h-4.5 text-primary" />
          </div>
          <span className="font-display font-semibold text-lg text-gold-gradient">ContentCreator Hub</span>
        </div>
        <Button
          onClick={() => { window.location.href = getLoginUrl(); }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
        >
          Sign In <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center px-6 pt-20 pb-16 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-medium mb-8">
          <Star className="w-3.5 h-3.5" />
          AI-Powered Social Media Command Centre
        </div>
        <h1 className="text-5xl md:text-6xl font-display font-bold leading-tight mb-6">
          Create Content That{" "}
          <span className="text-gold-gradient">Connects</span>{" "}
          With Every Audience
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Your team's intelligent platform for generating, approving, scheduling and publishing social media content across Facebook, Instagram and TikTok — tailored to 7 powerful audience niches.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg text-base px-8 font-medium"
          >
            Get Started Free <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Niches */}
      <section className="relative z-10 px-6 pb-16 max-w-5xl mx-auto">
        <p className="text-center text-sm text-muted-foreground mb-6 uppercase tracking-widest font-medium">
          7 Audience Niches
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {niches.map((niche) => (
            <div
              key={niche.label}
              className="flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium"
              style={{
                background: `${niche.color.replace(")", " / 0.08)")}`,
                borderColor: `${niche.color.replace(")", " / 0.25)")}`,
                color: niche.color,
              }}
            >
              <span>{niche.emoji}</span>
              {niche.label}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 pb-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-display font-semibold mb-3">Everything Your Team Needs</h2>
          <p className="text-muted-foreground">A complete workflow from idea to published post</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/20 hover:bg-card transition-all group"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                <feature.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-display font-semibold text-base mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 pb-20 max-w-3xl mx-auto text-center">
        <div className="p-10 rounded-3xl border border-primary/20 bg-primary/5">
          <Crown className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-display font-semibold mb-3">Ready to Transform Your Content?</h2>
          <p className="text-muted-foreground mb-8">Join your team and start creating content that resonates with every audience.</p>
          <Button
            size="lg"
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg text-base px-10 font-medium"
          >
            Sign In Now <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-6 text-center text-sm text-muted-foreground">
        <p>© 2026 ContentCreator Hub · Built for ambitious teams</p>
      </footer>
    </div>
  );
}
