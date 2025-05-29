"use client";

import { useState, useEffect, useRef } from "react";
import { FiSave, FiSettings, FiLock, FiCheck, FiLoader, FiRefreshCw } from "react-icons/fi";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useNotification } from "@/contexts/NotificationContext";
import { useSession } from "next-auth/react";

export default function AdminSettings() {
  const { data: session } = useSession();
  const { settings, updateSettings, saveChanges, isLoading, syncStatus, lastSyncMessage } = useUserSettings();
  const { showNotification } = useNotification();
  const [isSaving, setIsSaving] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const notificationShownRef = useRef<boolean>(false);
  
  // Local state for form controls
  const [filesVcApiKey, setFilesVcApiKey] = useState("");
  const [filesVcAccountId, setFilesVcAccountId] = useState("");
  const [isApiKeyModified, setIsApiKeyModified] = useState(false);
  const [isAccountIdModified, setIsAccountIdModified] = useState(false);

  // Load settings when component mounts
  useEffect(() => {
    if (!isLoading && settings) {
      // If API key exists in settings, show masked version
      if (settings.filesVcApiKey) {
        setFilesVcApiKey("••••••••••••••••");
      }
      
      // Set Account ID if it exists
      if (settings.filesVcAccountId) {
        setFilesVcAccountId(settings.filesVcAccountId);
      }
    }
  }, [isLoading, settings]);

  // Show notifications when sync status changes, but only once per sync operation
  useEffect(() => {
    console.log('Settings page: syncStatus changed to:', syncStatus, 'with message:', lastSyncMessage);
    console.log('Settings page: notificationShown flag is:', notificationShownRef.current);
    
    if (syncStatus === 'success' && !notificationShownRef.current) {
      notificationShownRef.current = true;
      console.log('Settings page: Showing success notification with message:', lastSyncMessage);
      showNotification('success', lastSyncMessage || 'Settings synchronized successfully');
      setTimeout(() => {
        notificationShownRef.current = false;
        console.log('Settings page: Reset notification flag after timeout');
      }, 5000); // Don't show another success notification for 5 seconds
    } else if (syncStatus === 'error') {
      notificationShownRef.current = true;
      console.log('Settings page: Showing error notification with message:', lastSyncMessage);
      showNotification('error', lastSyncMessage || 'Failed to synchronize settings');
      setTimeout(() => {
        notificationShownRef.current = false;
        console.log('Settings page: Reset notification flag after timeout');
      }, 5000);
    }
  }, [syncStatus, lastSyncMessage, showNotification]);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilesVcApiKey(e.target.value);
    setIsApiKeyModified(true);
  };
  
  const handleAccountIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilesVcAccountId(e.target.value);
    setIsAccountIdModified(true);
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    
    try {
      const updatedSettings: Record<string, any> = {};
      
      // Only update API key if it was modified
      if (isApiKeyModified && filesVcApiKey) {
        updatedSettings.filesVcApiKey = filesVcApiKey;
      }
      
      // Update Account ID if it was modified
      if (isAccountIdModified) {
        updatedSettings.filesVcAccountId = filesVcAccountId;
      }
      
      // First just update local state
      await updateSettings(updatedSettings);
      
      // Then explicitly save to server
      await saveChanges();
      
      setIsApiKeyModified(false);
      setIsAccountIdModified(false);
    } catch (error) {
      console.error("Failed to save settings:", error);
      // The error notification will be shown by the useEffect watching syncStatus
    } finally {
      setIsSaving(false);
    }
  };

  // Get sync status indicator
  const getSyncStatusIndicator = () => {
    switch (syncStatus) {
      case 'syncing':
        return (
          <div className="flex items-center text-blue-600 animate-pulse">
            <FiRefreshCw className="mr-1 h-4 w-4 animate-spin" />
            <span>Syncing...</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center text-green-600">
            <FiCheck className="mr-1 h-4 w-4" />
            <span>Synced</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-red-600">
            <FiLoader className="mr-1 h-4 w-4" />
            <span>Sync failed</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <FiSettings className="mr-3 h-6 w-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        </div>
        {getSyncStatusIndicator()}
      </div>
      
      {/* Debug section */}
      <div className="mb-4">
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="text-sm text-gray-500 underline"
        >
          {showDebug ? "Hide Debug Info" : "Show Debug Info"}
        </button>
        
        {showDebug && (
          <div className="mt-2 rounded-md bg-gray-100 p-3 text-xs font-mono">
            <div><strong>Session User ID:</strong> {(session?.user as any)?.id || 'No ID'}</div>
            <div><strong>Session Email:</strong> {session?.user?.email || 'No Email'}</div>
            <div><strong>Session Role:</strong> {(session?.user as any)?.role || 'No Role'}</div>
            <div><strong>Last Sync Status:</strong> {syncStatus || 'None'}</div>
            <div><strong>Last Sync Message:</strong> {lastSyncMessage || 'None'}</div>
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="rounded-md bg-gray-50 p-4 text-gray-600">Loading settings...</div>
      ) : (
        <div className="space-y-8">
          {/* Files.vc API Key */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 flex items-center text-lg font-medium text-gray-900">
              <FiLock className="mr-2 h-5 w-5 text-gray-700" />
              Files.vc Integration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="mb-1 block text-sm font-medium text-gray-700">
                  API Key
                </label>
                <input
                  type="password"
                  id="apiKey"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder={isApiKeyModified ? "Enter new API key" : "Enter API key or leave unchanged"}
                  value={filesVcApiKey}
                  onChange={handleApiKeyChange}
                />
                <p className="mt-1 text-xs text-gray-400">
                  {!isApiKeyModified && settings?.filesVcApiKey 
                    ? "API key is saved. Leave blank to keep the existing key." 
                    : "Your API key will be stored in the database."}
                </p>
              </div>
              
              <div>
                <label htmlFor="accountId" className="mb-1 block text-sm font-medium text-gray-700">
                  Account ID
                </label>
                <input
                  type="text"
                  id="accountId"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Enter your Files.vc Account ID"
                  value={filesVcAccountId}
                  onChange={handleAccountIdChange}
                />
                <p className="mt-1 text-xs text-gray-400">
                  Required to associate uploads with your Files.vc account. Find this in your Files.vc dashboard.
                </p>
              </div>
            </div>
          </div>
          
          {/* Save Button and Status */}
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={isSaving || syncStatus === 'syncing'}
              className={`inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                (isSaving || syncStatus === 'syncing') ? "cursor-not-allowed opacity-75" : ""
              }`}
            >
              {(isSaving || syncStatus === 'syncing') ? (
                <>
                  <FiRefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <FiSave className="mr-2 h-4 w-4" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}