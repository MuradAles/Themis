import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import './Sidebar.css';

// SVG Icons
const CreateIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const TemplatesIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
    <polyline points="10 9 9 9 8 9"></polyline>
  </svg>
);

const DocumentsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
    <polyline points="14 2 14 8 20 8"></polyline>
    <line x1="16" y1="13" x2="8" y2="13"></line>
    <line x1="16" y1="17" x2="8" y2="17"></line>
  </svg>
);

const LogoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"></polyline>
  </svg>
);

interface SidebarProps {
  onCreateNew?: () => void;
  onUploadNew?: () => void;
  showToggle?: boolean; // Show toggle button in sidebar header
}

export default function Sidebar({ onCreateNew, onUploadNew, showToggle = false }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(() => {
    const isDesktop = window.innerWidth >= 768;
    // Check localStorage for saved preference
    const saved = localStorage.getItem('sidebarOpen');
    if (saved !== null) {
      // Respect saved preference, but ensure desktop defaults to open if no preference
      return saved === 'true';
    }
    // Default: open on desktop, closed on mobile
    return isDesktop;
  });
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsOpen(false); // Auto-close on mobile
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save sidebar state to localStorage
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem('sidebarOpen', isOpen.toString());
      localStorage.setItem('sidebarCollapsed', isCollapsed.toString());
    }
  }, [isOpen, isCollapsed, isMobile]);

  const handleToggle = () => {
    if (!isOpen) {
      // If closed, open it
      setIsOpen(true);
    } else {
      // If open, toggle collapsed state
      setIsCollapsed(!isCollapsed);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const handleCreateNew = async () => {
    if (onCreateNew) {
      onCreateNew();
    } else {
      // Default behavior - navigate to create document
      navigate('/documents');
      // The page will handle the creation
    }
    if (isMobile) setIsOpen(false);
  };

  const handleUploadNew = () => {
    if (onUploadNew) {
      onUploadNew();
    }
    if (isMobile) setIsOpen(false);
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) setIsOpen(false);
  };

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Floating Toggle Button - Shows when sidebar is fully closed */}
      {!isOpen && (
        <button 
          className="sidebar-toggle-floating"
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
      )}

      {/* Overlay for mobile */}
      {isMobile && isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''} ${isMobile ? 'mobile' : ''}`}>
        <div className="sidebar-content">
          {/* Logo/Title with Toggle */}
          <div className="sidebar-header">
            <h2 className="sidebar-title">Themis</h2>
            {showToggle && isOpen && (
              <button 
                className={`sidebar-toggle-internal ${isCollapsed ? 'collapsed' : 'expanded'}`}
                onClick={handleToggle}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isCollapsed ? "Expand" : "Collapse"}
              >
                {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${isActive('/documents') ? 'active' : ''}`}
              onClick={() => handleNavigate('/documents')}
              title="Documents"
            >
              <DocumentsIcon />
              {!isCollapsed && <span>Documents</span>}
            </button>

            <button
              className={`nav-item ${isActive('/templates') ? 'active' : ''}`}
              onClick={() => handleNavigate('/templates')}
              title="Templates"
            >
              <TemplatesIcon />
              {!isCollapsed && <span>Templates</span>}
            </button>

            <button
              className="nav-item action-item create"
              onClick={handleCreateNew}
              title="Create New"
            >
              <CreateIcon />
              <span>Create New</span>
            </button>

            <button
              className="nav-item action-item upload"
              onClick={handleUploadNew}
              title="Upload PDF"
            >
              <UploadIcon />
              <span>Upload PDF</span>
            </button>

            <button
              className="nav-item logout"
              onClick={handleLogout}
              title="Logout"
            >
              <LogoutIcon />
              {!isCollapsed && <span>Logout</span>}
            </button>
          </nav>
        </div>
      </aside>
    </>
  );
}

