export interface StandbyCommand {
  type: "new_goal" | "question" | "change" | "quit";
  content: string;
}
