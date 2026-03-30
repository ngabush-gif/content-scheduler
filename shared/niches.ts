export const NICHES = [
  {
    id: "time_freedom",
    label: "Time Freedom",
    emoji: "⏰",
    description: "People seeking financial and time independence",
    tone: "Inspiring, aspirational, freedom-focused",
    toneStyle: "niche-time-freedom",
    keywords: ["freedom", "passive income", "work from anywhere", "lifestyle design", "financial independence"],
    promptHint: "Focus on the dream of working from anywhere, setting your own schedule, and achieving financial independence. Use aspirational language that paints a vivid picture of a free life.",
  },
  {
    id: "parents",
    label: "Solo & Busy Parents",
    emoji: "👨‍👩‍👧",
    description: "Single or time-poor parents building income around family",
    tone: "Empathetic, practical, family-first",
    toneStyle: "niche-parents",
    keywords: ["work from home", "flexible hours", "family income", "parenting", "balance"],
    promptHint: "Speak directly to the challenges of parenting while building income. Be empathetic, practical, and show how this fits around family life. Acknowledge the struggle and offer real hope.",
  },
  {
    id: "side_hustlers",
    label: "Side Hustlers",
    emoji: "💼",
    description: "People building income streams alongside their day job",
    tone: "Motivational, energetic, action-oriented",
    toneStyle: "niche-side-hustlers",
    keywords: ["extra income", "side hustle", "second income", "hustle", "opportunity"],
    promptHint: "Be energetic and motivational. Speak to people who are ambitious but time-constrained. Focus on quick wins, momentum, and building something real alongside their current job.",
  },
  {
    id: "online_business",
    label: "Online Business Learners",
    emoji: "🎓",
    description: "People wanting to learn and start an online business",
    tone: "Educational, encouraging, step-by-step",
    toneStyle: "niche-online-business",
    keywords: ["learn online business", "digital marketing", "e-commerce", "online income", "training"],
    promptHint: "Be educational and encouraging. Break things down simply. Speak to beginners who want to learn but feel overwhelmed. Use clear, jargon-free language and celebrate small wins.",
  },
  {
    id: "cultural",
    label: "Cultural Reach",
    emoji: "🌍",
    description: "Diverse cultural communities and international audiences",
    tone: "Inclusive, culturally aware, community-focused",
    toneStyle: "niche-cultural",
    keywords: ["community", "cultural", "diverse", "global", "inclusive", "heritage"],
    promptHint: "Be inclusive and culturally sensitive. Celebrate diversity and community. Speak to people from various backgrounds who want to build something together. Use inclusive language that resonates across cultures.",
  },
  {
    id: "over_50",
    label: "People Over 50",
    emoji: "🌟",
    description: "Mature adults discovering online opportunities",
    tone: "Encouraging, respectful, confidence-building",
    toneStyle: "niche-over50",
    keywords: ["retirement income", "mature learner", "never too late", "wisdom", "experience"],
    promptHint: "Be warm, encouraging and respectful. Acknowledge their life experience as an asset. Address fears about technology gently. Emphasize that it's never too late and that their wisdom is a strength.",
  },
  {
    id: "scam_survivors",
    label: "Scam Survivors",
    emoji: "🛡️",
    description: "People who have been scammed and need to rebuild trust",
    tone: "Empathetic, trust-building, transparent, gentle",
    toneStyle: "niche-scam-survivors",
    keywords: ["legitimate", "trusted", "transparent", "safe", "real results", "no promises"],
    promptHint: "Be deeply empathetic and transparent. Acknowledge the pain of being scammed. Focus on building trust slowly through honesty, proof, and realistic expectations. Never make big income claims. Emphasize legitimacy, community support, and gradual progress.",
  },
] as const;

export type NicheId = (typeof NICHES)[number]["id"];

export const PLATFORMS = [
  {
    id: "facebook",
    label: "Facebook",
    icon: "facebook",
    color: "platform-facebook",
    maxCaptionLength: 63206,
    hashtagLimit: 30,
    bestPractices: "Longer-form content works well. Use 3-5 hashtags. Include a clear call-to-action. Videos and images perform best.",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: "instagram",
    color: "platform-instagram",
    maxCaptionLength: 2200,
    hashtagLimit: 30,
    bestPractices: "Use up to 30 hashtags. Keep captions engaging but concise. First line is crucial. Stories and Reels drive high engagement.",
  },
  {
    id: "tiktok",
    label: "TikTok",
    icon: "tiktok",
    color: "platform-tiktok",
    maxCaptionLength: 2200,
    hashtagLimit: 10,
    bestPractices: "Short, punchy captions. Use trending sounds. Hook viewers in the first 3 seconds. Authenticity over perfection.",
  },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]["id"];

export const CONTENT_TYPES = [
  { id: "caption", label: "Caption", description: "Engaging post caption" },
  { id: "hashtags", label: "Hashtags", description: "Targeted hashtag sets" },
  { id: "script", label: "Video Script", description: "Full video script with hooks" },
  { id: "ideas", label: "Post Ideas", description: "Creative content ideas list" },
  { id: "full_post", label: "Full Post", description: "Complete post with all elements" },
] as const;

export const STATUS_CONFIG = {
  draft: { label: "Draft", class: "status-draft" },
  pending_review: { label: "Pending Review", class: "status-pending" },
  approved: { label: "Approved", class: "status-approved" },
  rejected: { label: "Rejected", class: "status-rejected" },
  published: { label: "Published", class: "status-published" },
} as const;
