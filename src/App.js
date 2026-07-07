import React, { useState, useEffect, useMemo } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from './components/Sidebar';
import AboutSection from './components/AboutSection';
import QualificationsSection from './components/QualificationSection';
import LanguagesSection from './components/LanguagesSection';
import ProjectsSection from './components/ProjectsSection';
import DissertationSection from './components/DissertationSection';
import WorkExperienceSection from './components/WorkExperienceSection';
import Footer from './components/Footer';
import DissertationDashboardPage from './components/DissertationDashboardPage';

const getLocationState = () => ({
  pathname: window.location.pathname,
  hash: window.location.hash,
});

const isDissertationRoute = (pathname) => pathname.replace(/\/+$/, '') === '/dissertation';

const App = () => {
  const [locationState, setLocationState] = useState(getLocationState);
  const [activeSection, setActiveSection] = useState('about');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const onDissertationPage = isDissertationRoute(locationState.pathname);

  // Define navigation sections
  const navSections = useMemo(() => [
    { id: 'about', label: 'About Me' },
    { id: 'qualifications', label: 'Qualifications' },
    { id: 'experience', label: 'Experience' },
    { id: 'languages', label: 'Languages' },
    { id: 'projects', label: 'Projects' },
    { id: 'dissertation', label: 'Dissertation' }
  ], []);

  useEffect(() => {
    const handlePopState = () => setLocationState(getLocationState());

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (pathname, hash = '') => {
    const nextPath = `${pathname}${hash}`;
    const currentPath = `${window.location.pathname}${window.location.hash}`;

    if (currentPath !== nextPath) {
      window.history.pushState({}, '', nextPath);
      setLocationState(getLocationState());
    }

    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const openPortfolioSection = (sectionId) => {
    navigateTo('/', `#${sectionId}`);

    window.requestAnimationFrame(() => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    });
  };

  const openDissertationPage = () => navigateTo('/dissertation/');

  // Handle scroll to set active section
  useEffect(() => {
    if (onDissertationPage) {
      return undefined;
    }

    const handleScroll = () => {
      const scrollPosition = window.scrollY + 100;

      for (const section of navSections.map((s) => s.id)) {
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
  }, [navSections, onDissertationPage]);

  // Reset mobile menu when moving to desktop.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (onDissertationPage) {
      return;
    }

    if (locationState.hash) {
      const targetId = locationState.hash.replace(/^#/, '');
      const element = document.getElementById(targetId);

      if (element) {
        window.requestAnimationFrame(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }
  }, [locationState.hash, onDissertationPage]);

  // Toggle sidebar for mobile
  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  // Scroll to section when nav link is clicked
  const scrollToSection = (sectionId) => {
    if (onDissertationPage) {
      openPortfolioSection(sectionId);
      return;
    }

    if (window.innerWidth < 768) {
      setIsSidebarOpen(false); // Close sidebar on mobile
    }

    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (onDissertationPage) {
    return <DissertationDashboardPage onBack={() => openPortfolioSection('dissertation')} />;
  }

  return (
    <div className="font-sans text-gray-800 min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Mobile Toggle Button */}
      <button
        className="md:hidden fixed top-4 left-4 z-30 bg-orange-600 text-white p-2 rounded-md shadow-md"
        onClick={toggleSidebar}
        aria-label="Toggle navigation menu"
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar Component */}
      <Sidebar
        navSections={navSections}
        activeSection={activeSection}
        isSidebarOpen={isSidebarOpen}
        scrollToSection={scrollToSection}
      />

      {/* Main Content */}
      <main className={`flex-1 md:ml-0 p-4 ${isSidebarOpen ? 'pt-96' : 'pt-16'} md:pt-4 flex`}>
        <div className="max-w-[1600px] w-full min-w-0 mx-auto flex flex-col gap-8">
          <AboutSection />
          <QualificationsSection />
          <WorkExperienceSection />
          <LanguagesSection />
          <ProjectsSection />
          <DissertationSection onOpenDashboard={openDissertationPage} />
          <Footer />
        </div>
      </main>
    </div>
  );
};

export default App;
