import { createContext, useContext, useState, useEffect } from "react";

type StoreContextType = {
  currentStoreId: number;
  setCurrentStoreId: (id: number) => void;
};

const StoreContext = createContext<StoreContextType>({
  currentStoreId: 1,
  setCurrentStoreId: () => {},
});

interface StoreProviderProps {
  user: { id: number; role: string; storeId: number | null };
  children: React.ReactNode;
}

export function StoreProvider({ user, children }: StoreProviderProps) {
  const getInitialStoreId = () => {
    // Staff are always locked to their assigned store
    if (user.role === 'staff' && user.storeId) return user.storeId;
    
    // Check localStorage for persisted store selection
    const savedStoreId = localStorage.getItem("currentStoreId");
    if (savedStoreId) {
      const id = parseInt(savedStoreId);
      if (!isNaN(id)) return id;
    }
    
    // Default to store 1 or user's store if owner has one (though owner usually manages all)
    return user.storeId || 1;
  };

  const [currentStoreId, setCurrentStoreId] = useState<number>(getInitialStoreId);

  // Persistence effect
  useEffect(() => {
    localStorage.setItem("currentStoreId", currentStoreId.toString());
  }, [currentStoreId]);

  // Handle user change (e.g. login/logout)
  useEffect(() => {
    if (user.role === 'staff' && user.storeId) {
      setCurrentStoreId(user.storeId);
    }
  }, [user.id, user.storeId, user.role]);

  return (
    <StoreContext.Provider value={{ currentStoreId, setCurrentStoreId }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
