import { NavLink } from "react-router";
import { MessageCircle, GitBranch, Home } from "lucide-react";

import { ModeToggle } from "./mode-toggle";

export default function Header() {
  const links = [
    { to: "/", label: "Home", icon: Home },
    { to: "/chat", label: "Chat", icon: MessageCircle },
    { to: "/flow-info", label: "Flow", icon: GitBranch },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <div className="flex flex-row items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">FSM</span>
            </div>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              EventBus
            </span>
          </div>

          <nav className="flex gap-1">
            {links.map(({ to, label, icon: Icon }) => {
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }: { isActive: boolean }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`
                  }
                  end={to === "/"}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
