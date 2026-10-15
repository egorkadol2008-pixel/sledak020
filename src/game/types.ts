export type EvidenceId = 'E01' | 'E02' | 'E03' | 'E04' | 'E05' | 'E06' | 'E07' | 'E08';
export type DocKind = 'inspection' | 'expert';
export type Hypothesis = 'unknown' | 'intervention' | 'suicide';
export type Decision = 'orlov' | 'volkova' | 'close';
export type Tab = 'overview' | 'scene' | 'people' | 'evidence' | 'documents' | 'journal';
export interface EvidenceProgress { stage: 1 | 2; receivedDay: number; verified: boolean }
export interface EvidenceDefinition { id: EvidenceId; title: string; short: string; source: string; initial: string; full: string; limitation: string; category: string }
export interface DocumentDraft { patronymic: string; date: string; photoCount: number; attachedPhotos: number; question: string }
export interface SignedDocument { id: string; kind: DocKind | 'report' | 'decision'; day: number; time: string; title: string; text: string; signature: string; signatureMode: 'drawn' | 'typed'; issues: string[] }
export interface JournalEntry { id: string; day: number; time: string; text: string }
export interface PendingRequest { key: 'camera' | 'expert' | 'access' | 'print' | 'finance'; requestedDay: number; dueDay: number }
export interface Ending { kind: 'strong' | 'weak' | 'wrong' | 'closed'; title: string; description: string; issues: string[]; epilogue: string }
export interface GameState {
  version: 1;
  day: number;
  spent: number;
  profileName: string;
  completedActions: string[];
  evidence: Partial<Record<EvidenceId, EvidenceProgress>>;
  drafts: Record<DocKind, DocumentDraft>;
  documents: SignedDocument[];
  journal: JournalEntry[];
  requests: PendingRequest[];
  signatureSamples: string[];
  hypothesis: Hypothesis;
  selectedEvidence: EvidenceId[];
  witnessApproach: 'support' | 'pressure' | null;
  cameraLost: boolean;
  ending: Ending | null;
}
export interface ActionDefinition { id: string; title: string; description: string; cost: number; tab: Tab; minDay: number; evidence?: EvidenceId }
export interface ActionAvailability { allowed: boolean; reason?: string; completed: boolean }
export interface Assessment { event: boolean; identity: boolean; integrity: boolean; issues: string[] }
