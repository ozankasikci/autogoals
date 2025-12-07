export interface Goal {
  id: string;
  description: string;
  status: string;
  plan?: string;
}

export interface GoalsFile {
  goals: Goal[];
}

export interface GoalStatus {
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
}
