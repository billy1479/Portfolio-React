import React, { useState } from 'react';
import { Github, ExternalLink } from 'lucide-react';
import projectsData from '../data/projects';

// Extract unique categories for backend and languages
const backendSet = new Set();
const languageSet = new Set();
projectsData.forEach(project => {
  const backends = (project.backend || 'Other').split(',').map(b => b.trim()).filter(Boolean);
  backends.forEach(b => backendSet.add(b));
  const languages = (project.languages || 'Other').split(',').map(l => l.trim()).filter(Boolean);
  languages.forEach(l => languageSet.add(l));
});

const backendCategories = ['All', ...Array.from(backendSet).sort()];
const languageCategories = ['All', ...Array.from(languageSet).sort()];

const ProjectsSection = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [filterMode, setFilterMode] = useState('backend'); // 'backend' or 'language'

  // Choose categories based on filter mode
  const categories = filterMode === 'backend' ? backendCategories : languageCategories;

  // Filtering logic
  const filteredProjects = activeFilter === 'All'
    ? projectsData
    : projectsData.filter(project => {
        if (filterMode === 'backend') {
          const backends = (project.backend || 'Other').split(',').map(b => b.trim());
          return backends.includes(activeFilter);
        } else {
          const languages = (project.languages || 'Other').split(',').map(l => l.trim());
          return languages.includes(activeFilter);
        }
      });

  return (
    <section id="projects" className="max-w-6xl w-full min-w-0 mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">Projects</h2>
        {/* Filter Mode Toggle */}
        <div className="mb-4 flex gap-2 items-center">
          <span className="text-gray-300 text-sm">Filter by:</span>
          <button
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 ${
              filterMode === 'backend' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={() => { setFilterMode('backend'); setActiveFilter('All'); }}
          >
            Backend
          </button>
          <button
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors duration-200 ${
              filterMode === 'language' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            onClick={() => { setFilterMode('language'); setActiveFilter('All'); }}
          >
            Language
          </button>
        </div>
        {/* Project Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full text-sm transition-colors duration-200 ${
                filter === activeFilter 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              aria-label={`Filter projects by ${filterMode} ${filter}`}
            >
              {filter}
            </button>
          ))}
        </div>
        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredProjects.map((project, index) => (
            <div 
              key={index} 
              className="bg-gray-700 rounded-lg overflow-hidden shadow-md border border-gray-600 transition duration-300 hover:shadow-lg hover:border-orange-500"
            >
              {/* Gallery */}
              {project.images && project.images.length > 0 ? (
                <div className="w-full h-48 bg-black flex items-center justify-center overflow-x-auto">
                  {project.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`${project.title} screenshot ${i + 1}`}
                      className="object-cover h-48 w-auto mx-auto"
                      style={{ minWidth: '200px', maxWidth: '100%' }}
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full h-48 bg-gray-900 flex items-center justify-center text-gray-500">
                  No images
                </div>
              )}
              <div className="p-6">
                <div className="mb-2 flex flex-wrap gap-2">
                  {(project.languages || 'Other').split(',').map((language, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-3 py-1 text-xs font-semibold text-orange-200 bg-orange-900 rounded-full"
                    >
                      {language.trim()}
                    </span>
                  ))}
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-200">{project.title}</h3>
                <div className="mb-2 text-gray-400 text-sm">
                  <strong>Backend:</strong> {project.backend}
                </div>
                <p className="text-gray-400 mb-4">{project.description}</p>
                <div className="flex gap-4 mt-4">
                  {project.links && project.links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-500 font-medium flex items-center gap-1 hover:text-orange-400 transition-colors duration-200"
                    >
                      {link.label}
                      {link.url.includes('github.com') ? <Github size={16} /> : <ExternalLink size={16} />}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ProjectsSection;