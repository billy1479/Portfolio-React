import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import AboutSection from './components/AboutSection';
import QualificationsSection from './components/QualificationSection';
import LanguagesSection from './components/LanguagesSection';
import ProjectsSection from './components/ProjectsSection';
import WorkExperienceSection from './components/WorkExperienceSection';
import Footer from './components/Footer';

const App = () => {
  const [activeSection, setActiveSection] = useState('about');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const [userToggledSidebar, setUserToggledSidebar] = useState(false);

  // Define navigation sections
  const navSections = useMemo(() => [
    { id: 'about', label: 'About Me' },
    { id: 'qualifications', label: 'Qualifications' },
    { id: 'experience', label: 'Experience' },
    { id: 'languages', label: 'Languages' },
    { id: 'projects', label: 'Projects' }
  ], []);
  
  // Handle scroll to set active section
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;
      
      for (const section of navSections.map(s => s.id)) {
        const element = document.getElementById(section);
        if (element) {
          const offsetTop = element.offsetTop;
          const offsetHeight = element.offsetHeight;
          
          if (
            scrollPosition >= offsetTop &&
            scrollPosition < offsetTop + offsetHeight
          ) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [navSections]);
  
  // Responsive sidebar open/close logic
  useEffect(() => {
    const handleResize = () => {
      if (!userToggledSidebar) {
        setIsSidebarOpen(window.innerWidth >= 768);
      }
    };
    window.addEventListener('resize', handleResize);
    // Set initial state on mount
    if (!userToggledSidebar) {
      setIsSidebarOpen(window.innerWidth >= 768);
    }
    return () => window.removeEventListener('resize', handleResize);
  }, [userToggledSidebar]);
  
  // Toggle sidebar for mobile
  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
    setUserToggledSidebar(true);
  };
  
  // Scroll to section when nav link is clicked
  const scrollToSection = (sectionId) => {
    setIsSidebarOpen(false); // Close sidebar on mobile
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  return (
    <div className="font-sans text-gray-200 min-h-screen bg-gray-900 flex flex-col md:flex-row">
      {/* Mobile Toggle Button */}
      <button 
        className="md:hidden fixed top-4 left-4 z-30 bg-orange-600 text-white p-2 rounded-md shadow-md"
        onClick={toggleSidebar}
        aria-label="Toggle navigation menu"
      >
        {isSidebarOpen ? <span>✕</span> : <span>☰</span>}
      </button>
      
      {/* Sidebar Component */}
      <Sidebar 
        navSections={navSections}
        activeSection={activeSection}
        isSidebarOpen={isSidebarOpen}
        scrollToSection={scrollToSection}
      />
      
      {/* Main Content */}
      <main className="flex-1 md:ml-0 p-4 pt-16 md:pt-4 flex">
        <div className="max-w-6xl w-full min-w-0 mx-auto flex flex-col gap-8">
            <AboutSection />
            <QualificationsSection />
            <WorkExperienceSection />
            <LanguagesSection />
            <ProjectsSection />
            <Footer />
        </div>
      </main>
    </div>
  );
};

export default App;