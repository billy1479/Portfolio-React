import React, { useState } from 'react';
import { Github, ExternalLink } from 'lucide-react';
import projectsData from '../data/projects';

const codingLanguages = new Set([
  'Python',
  'C++',
  'C#',
  'PHP',
  'Node.JS',
  'JavaScript',
  'TypeScript',
  'Solidity',
  'Bitcoin Script'
]);

// Extract unique categories for backend and languages
const backendSet = new Set();
const languageSet = new Set();
const moduleSet = new Set();
projectsData.forEach(project => {
  const backends = (project.backend || 'Other').split(',').map(b => b.trim()).filter(Boolean);
  backends.forEach(b => backendSet.add(b));
  const languages = (project.languages || 'Other').split(',').map(l => l.trim()).filter(Boolean);
  languages.filter(language => codingLanguages.has(language)).forEach(language => languageSet.add(language));
  if (project.module) {
    moduleSet.add(project.module);
  }
});

const backendCategories = ['All', ...Array.from(backendSet).sort()];
const languageCategories = ['All', ...Array.from(languageSet).sort()];
const moduleCategories = ['All', ...Array.from(moduleSet).sort()];

const ProjectsSection = () => {
  const [activeFilter, setActiveFilter] = useState('All');
  const [filterMode, setFilterMode] = useState('backend'); // 'backend', 'language', or 'module'

  // Choose categories based on filter mode
  const categories =
    filterMode === 'backend'
      ? backendCategories
      : filterMode === 'language'
        ? languageCategories
        : moduleCategories;

  // Filtering logic
  const filteredProjects = activeFilter === 'All'
    ? projectsData
    : projectsData.filter(project => {
        if (filterMode === 'backend') {
          const backends = (project.backend || 'Other').split(',').map(b => b.trim());
          return backends.includes(activeFilter);
        } else if (filterMode === 'language') {
          const languages = (project.languages || 'Other').split(',').map(l => l.trim());
          return languages.includes(activeFilter);
        }
        return project.module === activeFilter;
      });

  return (
    <section id="projects" className="max-w-6xl w-full min-w-0 mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">Projects</h2>
        {/* Filter Mode Toggle */}
        <div className="mb-4 flex gap-2 items-center">
          <span className="text-gray-300 text-sm">Filter by:</span>
          <button
            className={`inline-flex min-h-8 items-center justify-center rounded-lg px-3 py-1 text-xs font-semibold leading-none transition-colors duration-200 ${
              filterMode === 'backend' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
            onClick={() => { setFilterMode('backend'); setActiveFilter('All'); }}
          >
            Backend
          </button>
          <button
            className={`inline-flex min-h-8 items-center justify-center rounded-lg px-3 py-1 text-xs font-semibold leading-none transition-colors duration-200 ${
              filterMode === 'language' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
            onClick={() => { setFilterMode('language'); setActiveFilter('All'); }}
          >
            Language
          </button>
          <button
            className={`inline-flex min-h-8 items-center justify-center rounded-lg px-3 py-1 text-xs font-semibold leading-none transition-colors duration-200 ${
              filterMode === 'module' ? 'bg-orange-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
            onClick={() => { setFilterMode('module'); setActiveFilter('All'); }}
          >
            Module
          </button>
        </div>
        {/* Project Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 text-sm leading-none transition-colors duration-200 ${
                filter === activeFilter 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
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
                      className="inline-flex min-h-8 items-center justify-center rounded-lg bg-orange-900 px-3 py-1 text-xs font-semibold leading-none text-orange-200"
                    >
                      {language.trim()}
                    </span>
                  ))}
                </div>
                <h3 className="text-xl font-bold mb-2 text-gray-200">{project.title}</h3>
                <div className="mb-2 text-gray-400 text-sm">
                  <strong>Backend:</strong> {project.backend}
                </div>
                {project.courseworkPercentage != null && (
                  <div className="mb-2 text-gray-400 text-sm">
                    <strong>Coursework Mark:</strong> {project.courseworkPercentage}%
                  </div>
                )}
                <p className="text-gray-400 mb-4">{project.description}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {project.links && project.links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-orange-500/60 px-4 py-2 text-sm font-medium text-orange-300 transition-colors duration-200 hover:bg-orange-500/10 hover:text-orange-200"
                    >
                      {link.url.includes('github.com') ? <Github size={16} /> : <ExternalLink size={16} />}
                      <span>{link.label}</span>
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
