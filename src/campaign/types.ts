import type { GameState } from '../game/types';

export type CaseId = '001' | '002' | '003' | '004' | '005';
export type SkillId = 'forensics' | 'psychology' | 'law' | 'leadership' | 'fitness' | 'attention' | 'precision';
export type ContactId = 'volkova' | 'lebedeva' | 'mentor' | 'danilov';
export type UpgradeId = 'lamp' | 'chair' | 'scanner' | 'safe' | 'computer' | 'books';
export type CampaignView = 'campaign' | 'case' | 'career' | 'office' | 'contacts' | 'archive';
export type Stats = { money: number; budget: number; xp: number; skillPoints: number; reputation: number; integrity: number; corruption: number; stress: number; health: number; threat: number };
export interface Effects { money?: number; budget?: number; xp?: number; reputation?: number; integrity?: number; corruption?: number; stress?: number; health?: number; threat?: number; relationships?: Partial<Record<ContactId, number>>; flags?: string[] }
export interface Choice { id: string; label: string; response: string; effects?: Effects; grants?: string[] }
export interface CaseEvidence { id: string; title: string; body: string; source: string; limitation: string; role: 'event' | 'link' | 'context' | 'motive' | 'background' }
export interface CaseAction { id: string; title: string; description: string; result: string; category: 'scene' | 'interview' | 'research'; cost: number; minDay: number; requires?: string[]; grants: string[]; delay?: number; skill?: SkillId; choices?: Choice[]; deadline?: number }
export interface FormField { id: string; label: string; initial: string; correct: string; source: string }
export interface CourtOption { id: string; label: string; response: string; quality: -1 | 0 | 1; requiresEvidence?: string[] }
export interface CourtRound { id: string; speaker: string; question: string; options: CourtOption[] }
export interface CaseDefinition {
  id: CaseId; title: string; subtitle: string; location: string; summary: string; briefing: string; chapterLabel: string; color: string;
  suspects: { id: string; name: string; role: string }[]; correctSuspect: string;
  evidence: CaseEvidence[]; actions: CaseAction[]; formTitle: string; formFields: FormField[]; court: CourtRound[];
  reward: { money: number; budget: number; xp: number }; link: string;
}
export interface CampaignDocument { id: string; caseId: CaseId; kind: 'protocol' | 'decision' | 'court'; title: string; day: number; text: string; signature: string; mode: 'drawn' | 'typed'; issues: string[] }
export interface CaseResult { kind: 'strong' | 'weak' | 'wrong' | 'closed'; title: string; text: string; issues: string[] }
export interface CourtAnswer { roundId: string; optionId: string; response: string; quality: number }
export interface CourtResult { kind: 'accepted' | 'returned' | 'dismissed'; title: string; text: string }
export interface CaseProgress {
  status: 'locked' | 'available' | 'investigating' | 'court' | 'resolved';
  day: number; spent: number; completedActions: string[]; evidence: string[];
  pending: { actionId: string; dueDay: number; evidence: string[] }[];
  choices: Record<string, string>; draft: Record<string, string>; documents: CampaignDocument[];
  selectedEvidence: string[];
  result: CaseResult | null; courtAnswers: CourtAnswer[]; courtResult: CourtResult | null;
}
export interface CampaignEvent { id: string; title: string; text: string; caseId: CaseId; choices: Choice[]; selected: string | null; response: string | null }
export interface CampaignLog { id: string; caseId: CaseId; day: number; text: string }
export interface FinanceEntry { id: string; caseId: CaseId; day: number; account: 'money' | 'budget'; amount: number; balance: number; reason: string }
export interface CareerGoal { id: string; title: string; description: string; progress: number; target: number; claimed: boolean; rewardText: string }
export interface ContactSupport { title: string; description: string; effectText: string; requiredTrust: number; available: boolean; used: boolean; reason?: string; cost: number }
export interface CampaignState {
  version: 2; profileName: string; activeCase: CaseId; firstCase: GameState;
  cases: Record<CaseId, CaseProgress>; stats: Stats; skills: Record<SkillId, number>;
  relationships: Record<ContactId, number>; upgrades: UpgradeId[]; flags: string[]; contactVisits: string[];
  events: CampaignEvent[]; journal: CampaignLog[]; finances: FinanceEntry[]; chapterComplete: boolean;
}
export interface CampaignAvailability { allowed: boolean; completed: boolean; cost: number; reason?: string }
export interface CaseAssessment { event: boolean; link: boolean; context: boolean; documents: boolean; issues: string[] }
export interface UpgradeDefinition { id: UpgradeId; name: string; description: string; effect: string; price: number; account: 'money' | 'budget'; icon: 'lamp' | 'chair' | 'scanner' | 'safe' | 'computer' | 'books' }
export interface SkillDefinition { id: SkillId; name: string; description: string; effect: string }
export interface ContactDefinition { id: ContactId; name: string; role: string; initials: string; description: string; choices: Choice[] }
