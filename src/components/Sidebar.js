import React from 'react';
import { Github, Linkedin, Code, FileText, Briefcase, User, Scroll, Download, BookOpen } from 'lucide-react';

const Sidebar = ({ navSections, activeSection, isSidebarOpen, scrollToSection }) => {
  // Icon mapping for navigation items
  const getIcon = (id) => {
    switch (id) {
      case 'about':
        return <User size={20} />;
      case 'experience':
        return <Briefcase size={20} />;
       case 'qualifications':
        return <Scroll size={20} />;
      case 'languages':
        return <Code size={20} />;
      case 'projects':
        return <FileText size={20} />;
      case 'dissertation':
        return <BookOpen size={20} />;
      default:
        return null;
    }
  };

  return (
    <>
      <aside
        className="hidden md:sticky md:top-0 md:z-20 md:flex md:w-64 md:flex-col md:bg-orange-600 md:text-white"
        style={{ height: '100dvh', WebkitOverflowScrolling: 'touch' }}
      >
        {/* Profile Section */}
        <div className="shrink-0 border-b border-orange-500 p-6 text-center">
          <div className="w-32 h-32 mx-auto bg-gradient-to-br from-orange-500 to-amber-600 rounded-full overflow-hidden border-4 border-white/40 shadow-md mb-4">
            <img
              src={require(`../assets/new_profile_picture.jpeg`)}
              alt="Developer portrait"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="text-xl text-white font-bold mt-2">William Stapleton</h1>
          <p className="text-orange-100">First Class (Hons) BSc Computer Science</p>
          <br></br>
          <p className="text-orange-100 text-sm">Software Engineer @ Red Bull Technology</p>
          <br></br>
          <p className="text-orange-100 text-sm">Power Platform Developer</p>
          <br></br>
          <div className="flex justify-center space-x-4 mt-4">
            <a
              href="https://github.com/billy1479"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-100 hover:text-white cursor-pointer transition-colors duration-200 hover:bg-orange-500 rounded-full p-1"
              aria-label="GitHub"
            >
              <Github size={20} />
            </a>
            <a
              href="https://www.linkedin.com/in/william-stapleton-57674b219/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-100 hover:text-white cursor-pointer transition-colors duration-200 hover:bg-orange-500 rounded-full p-1"
              aria-label="LinkedIn"
            >
              <Linkedin size={20} />
            </a>
          </div>

          {/* Download CV Button in Topbar */}
          <div className="mt-4">
            <a
              href="https://williamstapleton-my.sharepoint.com/:b:/g/personal/billy_williamstapleton_co_uk/IQBggFiXezY2QroITx4cIuMmAf3FiMjFicQyDtCEewIsgMo?e=OUwWg8"
              download
              className="flex items-center justify-center gap-2 text-orange-100 hover:text-white transition-colors duration-200 hover:bg-orange-500 rounded-lg px-3 py-2"
            >
              <Download size={20} />
              <span className="text-sm">Download CV</span>
            </a>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="min-h-0 flex-1 overflow-y-auto p-4 pb-6 overscroll-contain">
          {navSections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`flex items-center gap-3 w-full text-left py-3 px-4 rounded-lg transition duration-200 ${
                activeSection === section.id
                  ? 'bg-white text-orange-600'
                  : 'text-orange-100 hover:text-white hover:bg-orange-500'
              }`}
              aria-label={`Navigate to ${section.label} section`}
            >
              {getIcon(section.id)}
              {section.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Mobile vertical navigation, shown only when burger is expanded */}
      {isSidebarOpen ? (
        <nav
          className="fixed inset-x-0 top-0 z-20 w-full md:hidden bg-orange-600 px-0 pb-3 pt-16 shadow-lg"
        >
          {navSections.map((section) => (
            <button
              key={section.id}
              onClick={() => scrollToSection(section.id)}
              className={`mb-2 flex w-full items-center justify-center gap-3 px-4 py-3 text-center text-sm transition duration-200 last:mb-0 ${
                activeSection === section.id
                  ? 'text-white'
                  : 'text-gray-200 hover:text-white'
              }`}
              aria-label={`Navigate to ${section.label} section`}
            >
              {getIcon(section.id)}
              {section.label}
            </button>
          ))}
        </nav>
      ) : null}
    </>
  );
};

export default Sidebar;
