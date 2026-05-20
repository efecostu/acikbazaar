export type MarketCategory = 'politics' | 'economy' | 'sports' | 'tech' | 'world';
export type MarketRegion = 'turkey' | 'global';
export type MarketStatus = 'active' | 'closed' | 'resolved';
export type BetSide = 'yes' | 'no';
export type BetStatus = 'pending' | 'won' | 'lost';

export interface Profile {
  id: string;
  username: string;
  balance: number;
  total_bets: number;
  total_won: number;
  created_at: string;
}

export interface Market {
  id: string;
  title_en: string;
  title_tr: string;
  description_en: string | null;
  description_tr: string | null;
  category: MarketCategory;
  region: MarketRegion;
  yes_prob: number;
  yes_pool: number;
  no_pool: number;
  total_volume: number;
  participant_count: number;
  status: MarketStatus;
  outcome: boolean | null;
  ends_at: string;
  tag: string | null;
  created_at: string;
}

export interface Bet {
  id: string;
  user_id: string;
  market_id: string;
  side: BetSide;
  amount: number;
  odds_at_bet: number;
  potential_payout: number;
  status: BetStatus;
  settled_at: string | null;
  created_at: string;
  market?: Market;
}

export interface LeaderboardEntry {
  username: string;
  balance: number;
  total_bets: number;
  total_won: number;
  profit: number;
  win_rate: number;
}

export type Lang = 'tr' | 'en';
