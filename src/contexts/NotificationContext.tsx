import React, { createContext, useState, useContext, ReactNode, useCallback } from 'react';
import { FiCheckCircle, FiAlertCircle, FiInfo, FiX } from 'react-icons/fi';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
  timestamp: number;
}

interface NotificationContextProps {
  notifications: Notification[];
  showNotification: (type: NotificationType, message: string, duration?: number) => void;
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

// Maximum number of notifications to show at once
const MAX_NOTIFICATIONS = 3;

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Check for duplicate messages to avoid notification spam
  const isDuplicateMessage = useCallback((message: string): boolean => {
    const now = Date.now();
    // Check if we have the same message within last 5 seconds
    return notifications.some(
      notification => 
        notification.message === message && 
        now - notification.timestamp < 5000
    );
  }, [notifications]);

  const showNotification = useCallback((type: NotificationType, message: string, duration = 3000) => {
    // Skip if it's a duplicate recent message
    if (isDuplicateMessage(message)) {
      return;
    }
    
    const id = Math.random().toString(36).substring(2, 9);
    
    const newNotification: Notification = {
      id,
      type,
      message,
      duration,
      timestamp: Date.now()
    };
    
    setNotifications(prev => {
      // Keep only the most recent notifications up to MAX_NOTIFICATIONS
      const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      return updated;
    });
    
    // Auto-dismiss after duration (if not 0)
    if (duration > 0) {
      setTimeout(() => {
        dismissNotification(id);
      }, duration);
    }
  }, [isDuplicateMessage]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter((notification) => notification.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, showNotification, dismissNotification }}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

// Toast notification container that will render at the top of the app
const NotificationContainer = () => {
  const context = useContext(NotificationContext);
  
  if (!context) return null;
  
  const { notifications, dismissNotification } = context;
  
  if (notifications.length === 0) return null;
  
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col space-y-2">
      {notifications.map((notification) => (
        <NotificationToast 
          key={notification.id} 
          notification={notification} 
          onDismiss={() => dismissNotification(notification.id)} 
        />
      ))}
    </div>
  );
};

// Individual toast notification
const NotificationToast = ({ notification, onDismiss }: { notification: Notification, onDismiss: () => void }) => {
  const { type, message } = notification;
  
  const bgColor = {
    success: 'bg-green-50 border-green-500',
    error: 'bg-red-50 border-red-500',
    info: 'bg-blue-50 border-blue-500',
    warning: 'bg-yellow-50 border-yellow-500',
  }[type];
  
  const textColor = {
    success: 'text-green-800',
    error: 'text-red-800',
    info: 'text-blue-800',
    warning: 'text-yellow-800',
  }[type];
  
  const iconColor = {
    success: 'text-green-400',
    error: 'text-red-400',
    info: 'text-blue-400',
    warning: 'text-yellow-400',
  }[type];
  
  const Icon = {
    success: FiCheckCircle,
    error: FiAlertCircle,
    info: FiInfo,
    warning: FiAlertCircle,
  }[type];

  return (
    <div className={`flex w-80 items-start space-x-3 rounded-md border-l-4 p-4 shadow-md ${bgColor}`}>
      <div className="flex-shrink-0">
        <Icon className={`h-5 w-5 ${iconColor}`} aria-hidden="true" />
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${textColor}`}>{message}</p>
      </div>
      <div className="flex-shrink-0">
        <button
          type="button"
          className={`inline-flex rounded-md p-1.5 ${textColor} hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2`}
          onClick={onDismiss}
        >
          <span className="sr-only">Dismiss</span>
          <FiX className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

// Custom hook to use the notification context
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}; 