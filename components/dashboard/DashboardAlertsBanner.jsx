"use client";

import { memo } from "react";
import { AlertCard } from "./AlertCard";
import { motion, AnimatePresence } from "framer-motion";

function DashboardAlertsBannerComponent({ alerts = [] }) {
  if (!alerts.length) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        className="space-y-3"
      >
        <ul className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
          {alerts.slice(0, 4).map((alert) => (
            <li key={alert.id}>
              <AlertCard
                id={alert.id}
                title={alert.title}
                description={alert.description}
                severity={alert.severity || "warning"}
                href={alert.href}
                icon={alert.icon}
              />
            </li>
          ))}
        </ul>
      </motion.div>
    </AnimatePresence>
  );
}

export const DashboardAlertsBanner = memo(DashboardAlertsBannerComponent);
