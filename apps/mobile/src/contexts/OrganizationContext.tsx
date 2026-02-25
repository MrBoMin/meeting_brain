import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Organization } from '../types/database';
import { getMyOrganizations, OrgWithRole } from '../services/organizationService';
import { useAuth } from '../hooks/useAuth';

const ACTIVE_ORG_KEY = '@meetingbrain/active_org_id';

interface OrganizationContextType {
  organizations: OrgWithRole[];
  activeOrg: OrgWithRole | null;
  setActiveOrgId: (id: string | null) => void;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizations: [],
  activeOrg: null,
  setActiveOrgId: () => {},
  isLoading: true,
  refresh: async () => {},
});

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [organizations, setOrganizations] = useState<OrgWithRole[]>([]);
  const [activeOrgId, _setActiveOrgId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadOrgs = useCallback(async () => {
    if (!isAuthenticated) {
      setOrganizations([]);
      setIsLoading(false);
      return;
    }
    try {
      const orgs = await getMyOrganizations();
      setOrganizations(orgs);

      const savedId = await AsyncStorage.getItem(ACTIVE_ORG_KEY);
      if (savedId && orgs.find((o) => o.id === savedId)) {
        _setActiveOrgId(savedId);
      } else {
        _setActiveOrgId(null);
      }
    } catch (e) {
      console.warn('Failed to load organizations:', e);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const setActiveOrgId = useCallback(async (id: string | null) => {
    _setActiveOrgId(id);
    if (id) {
      await AsyncStorage.setItem(ACTIVE_ORG_KEY, id);
    } else {
      await AsyncStorage.removeItem(ACTIVE_ORG_KEY);
    }
  }, []);

  const activeOrg = activeOrgId
    ? organizations.find((o) => o.id === activeOrgId) ?? null
    : null;

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        activeOrg,
        setActiveOrgId,
        isLoading,
        refresh: loadOrgs,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  return useContext(OrganizationContext);
}
