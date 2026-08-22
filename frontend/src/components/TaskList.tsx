import { useState } from "react";
import type { Task } from "../App.js";

interface TaskListProps {
  tasks: Task[];
  activeTaskId: string | null;
  timerState: "idle" | "focus" | "break";
  onAdd: (title: string) => void;
  onSelect: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}

export function TaskList({
  tasks,
  activeTaskId,
  timerState,
  onAdd,
  onSelect,
  onDelete,
}: TaskListProps) {
  const [newTitle, setNewTitle] = useState("");

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    onAdd(newTitle.trim());
    setNewTitle("");
  };

  return (
    <div className="task-list">
      <h2 className="task-list-title">Queue</h2>

      <div className="task-input-row">
        <input
          type="text"
          placeholder="What needs forging?"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          aria-label="New task title"
        />
        <button onClick={handleAdd} aria-label="Add task" className="btn-add">
          +
        </button>
      </div>

      <div className="task-items">
        {tasks.length === 0 && (
          <p className="empty-state">Add tasks to start forging</p>
        )}
        {tasks.map((task) => {
          const isActive = task.id === activeTaskId;
          const canSelect = timerState === "idle";

          return (
            <div
              key={task.id}
              className={`task-item ${isActive ? "active" : ""} ${!canSelect ? "locked" : ""}`}
              onClick={() => canSelect && onSelect(task.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && canSelect && onSelect(task.id)}
              aria-pressed={isActive}
            >
              <span className="task-dot" />
              <span className="task-item-title">{task.title}</span>
              {task.estimatedMinutes && (
                <span className="task-est" title="Suggested session length">
                  {task.estimatedMinutes}m
                </span>
              )}
              {canSelect && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(task.id);
                  }}
                  aria-label={`Delete ${task.title}`}
                  className="btn-delete-small"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
