"use client";

import { useState, useEffect, useRef } from "react";
import { FiSave, FiSettings, FiLock, FiCheck, FiLoader, FiRefreshCw, FiAlertCircle, FiCheckCircle } from "react-icons/fi";
import MotionIcon from "@/components/ui/MotionIcon";
import { useUserSettings } from "@/hooks/useUserSettings";
import toast from "react-hot-toast";
import { useSession } from "next-auth/react";
import { useAdmin } from "@/lib/hooks/useAdmin";
import { useRouter } from "next/navigation";

export default function AdminSettings() {
  const { data: session } = useSession();
  const { settings, updateSettings, saveChanges, isLoading, syncStatus, lastSyncMessage } = useUserSettings();
  const [isSaving, setIsSaving] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const notificationShownRef = useRef<boolean>(false);
  const { isAdmin, isLoading: isAdminLoading } = useAdmin();
  const router = useRouter();
  
  // Local state for form controls
  const [filesVcApiKey, setFilesVcApiKey] = useState("");
  const [filesVcAccountId, setFilesVcAccountId] = useState("");
  const [isApiKeyModified, setIsApiKeyModified] = useState(false);
  const [isAccountIdModified, setIsAccountIdModified] = useState(false);
  
  // Redirect regular users to the add book page
  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      router.push('/admin/books/new');
    }
  }, [isAdmin, isAdminLoading, router]);
  
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
      toast.success(lastSyncMessage || 'Settings synchronized successfully');
      setTimeout(() => {
        notificationShownRef.current = false;
        console.log('Settings page: Reset notification flag after timeout');
      }, 5000); // Don't show another success notification for 5 seconds
    } else if (syncStatus === 'error') {
      notificationShownRef.current = true;
      console.log('Settings page: Showing error notification with message:', lastSyncMessage);
      toast.error(lastSyncMessage || 'Failed to synchronize settings');
      setTimeout(() => {
        notificationShownRef.current = false;
        console.log('Settings page: Reset notification flag after timeout');
      }, 5000);
    }
  }, [syncStatus, lastSyncMessage]);

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
            <MotionIcon animation="bounce" trigger="always" className="mr-1">
              <FiCheck className="h-4 w-4" />
            </MotionIcon>
            <span>Synced</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-red-600">
            <MotionIcon animation="spin" trigger="always" className="mr-1">
              <FiLoader className="h-4 w-4" />
            </MotionIcon>
            <span>Sync failed</span>
          </div>
        );
      default:
        return null;
    }
  };
  
  // If loading or not admin, don't render the page yet
  if (isAdminLoading || !isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center">
          <MotionIcon animation="spin" trigger="hover" className="mr-3">
            <FiSettings className="h-6 w-6 text-primary" />
          </MotionIcon>
          <h1 className="text-2xl font-bold text-base-content">Admin Settings</h1>
        </div>
        {getSyncStatusIndicator()}
      </div>
      
      {/* Debug section */}
      <div className="mb-4">
        <button 
          onClick={() => setShowDebug(!showDebug)}
          className="text-xs text-base-content/60 underline hover:text-base-content"
        >
          {showDebug ? "Hide Debug Info" : "Show Debug Info"}
        </button>
        
        {showDebug && (
          <div className="mt-2 rounded-xl bg-base-200 border border-base-300 p-3 text-xs font-mono text-base-content space-y-1">
            <div><strong>Session User ID:</strong> {(session?.user as any)?.id || 'No ID'}</div>
            <div><strong>Session Email:</strong> {session?.user?.email || 'No Email'}</div>
            <div><strong>Session Role:</strong> {(session?.user as any)?.role || 'No Role'}</div>
            <div><strong>Last Sync Status:</strong> {syncStatus || 'None'}</div>
            <div><strong>Last Sync Message:</strong> {lastSyncMessage || 'None'}</div>
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="card bg-base-200 border border-base-300 p-6 text-center text-base-content/70">
          <span className="loading loading-spinner text-primary mx-auto mb-2"></span>
          Loading settings...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Files.vc API Key */}
          <div className="card bg-base-200 border border-base-300 p-6 shadow-sm">
            <h2 className="mb-4 flex items-center text-lg font-bold text-base-content">
              <MotionIcon animation="wiggle" trigger="hover" className="mr-2">
                <FiLock className="h-5 w-5 text-primary" />
              </MotionIcon>
              Files.vc Integration
            </h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="apiKey" className="label-text mb-1 block text-sm font-semibold text-base-content">
                  API Key
                </label>
                <input
                  type="password"
                  id="apiKey"
                  className="input input-bordered w-full bg-base-100 text-base-content"
                  placeholder={isApiKeyModified ? "Enter new API key" : "Enter API key or leave unchanged"}
                  value={filesVcApiKey}
                  onChange={handleApiKeyChange}
                />
                <p className="mt-1 text-xs text-base-content/60">
                  {!isApiKeyModified && settings?.filesVcApiKey 
                    ? "API key is saved. Leave blank to keep the existing key." 
                    : "Your API key will be stored in the database."}
                </p>
              </div>
              
              <div>
                <label htmlFor="accountId" className="label-text mb-1 block text-sm font-semibold text-base-content">
                  Account ID
                </label>
                <input
                  type="text"
                  id="accountId"
                  className="input input-bordered w-full bg-base-100 text-base-content"
                  placeholder="Enter your Files.vc Account ID"
                  value={filesVcAccountId}
                  onChange={handleAccountIdChange}
                />
                <p className="mt-1 text-xs text-base-content/60">
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
              className="btn btn-primary px-6 gap-2"
            >
              {(isSaving || syncStatus === 'syncing') ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Syncing...
                </>
              ) : (
                <>
                  <MotionIcon animation="float" trigger="hover">
                    <FiSave className="h-4 w-4" />
                  </MotionIcon>
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