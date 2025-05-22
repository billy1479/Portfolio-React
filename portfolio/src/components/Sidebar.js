import React from 'react';
import { Github, Mail, Linkedin, Code, FileText, Briefcase, User, Scroll, Download } from 'lucide-react';

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
      default:
        return null;
    }
  };

  return (
    <aside className={`fixed md:sticky top-0 md:top-0 left-0 z-20 w-64 h-screen bg-gray-800 text-white transition-transform duration-300 transform ${
      isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
    }`}>
      {/* Profile Section */}
      <div className="p-6 text-center border-b border-gray-700">
        <div className="w-32 h-32 mx-auto bg-gradient-to-br from-orange-500 to-amber-600 rounded-full overflow-hidden border-4 border-gray-700 shadow-md mb-4">
          <img 
            src="/api/placeholder/200/200" 
            alt="Developer portrait" 
            className="w-full h-full object-cover"
          />
        </div>
        <h1 className="text-xl text-gray-200 font-bold mt-2">William Stapleton</h1>
        <p className="text-gray-400">Software Engineer</p>
        
        <div className="flex justify-center space-x-4 mt-4">
          <div className="text-gray-400 hover:text-white cursor-pointer transition-colors duration-200 hover:bg-gray-300 rounded-full p-1">
            <Github size={20} />
          </div>
          <div className="text-gray-400 hover:text-white cursor-pointer transition-colors duration-200 hover:bg-gray-300 rounded-full p-1">
            <Linkedin size={20} />
          </div>
        </div>

        {/* Download CV Button in Topbar */}
        <div className="mt-4">
          <a
            href="/Your_CV.pdf"  // replace with your actual CV link
            download
            className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors duration-200 hover:bg-gray-300 rounded-lg px-3 py-2"
          >
            <Download size={20} />
            <span className="text-sm">Download CV</span>
          </a>
        </div>
      </div>

      
      
      {/* Navigation */}
      <nav className="p-4">
        {navSections.map((section) => (
          <button
            key={section.id}
            onClick={() => scrollToSection(section.id)}
            className={`flex items-center gap-3 w-full text-left py-3 px-4 rounded-lg transition duration-200 ${
              activeSection === section.id 
                ? 'bg-orange-600 text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
            aria-label={`Navigate to ${section.label} section`}
          >
            {getIcon(section.id)}
            {section.label}
          </button>
        ))}
      </nav>
      
      {/* Contact Info */}
      {/* <div className="absolute bottom-0 left-0 w-full p-4 border-t border-gray-700 text-sm">
        <p className="text-gray-400 mb-1">hello@example.com</p>
        <p className="text-gray-400">+1 (555) 123-4567</p>
      </div> */}
    </aside>
  );
};

export default Sidebar;