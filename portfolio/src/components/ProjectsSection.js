import React, { useState } from 'react';
import { Github, ExternalLink } from 'lucide-react';
import projectsData from '../data/projects';

const ProjectsSection = () => {
  // Get unique categories from backend or languages
  const categories = ['All', ...new Set(projectsData.map(project => project.backend || 'Other'))];

  const [activeFilter, setActiveFilter] = useState('All');
  const filteredProjects = activeFilter === 'All'
    ? projectsData
    : projectsData.filter(project => (project.backend || 'Other') === activeFilter);

  return (
    <section id="projects" className="max-w-6xl w-full min-w-0 mb-16 bg-gray-800 rounded-xl shadow-md overflow-hidden">
      <div className="p-8">
        <h2 className="text-3xl font-bold mb-6 text-orange-500 border-b border-gray-700 pb-2">Projects</h2>
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
              aria-label={`Filter projects by ${filter}`}
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
                <div className="w-full h-48 bg-black flex overflow-x-auto">
                  {project.images.map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`${project.title} screenshot ${i + 1}`}
                      className="object-cover h-48 w-auto"
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
                <span className="inline-block px-3 py-1 text-xs font-semibold text-orange-200 bg-orange-900 rounded-full mb-2">
                  {project.backend || 'Other'}
                </span>
                <h3 className="text-xl font-bold mb-2 text-gray-200">{project.title}</h3>
                <div className="mb-2 text-gray-400 text-sm">
                  <strong>Languages:</strong> {project.languages}
                </div>
                <p className="text-gray-400 mb-4">{project.description}</p>
                <div className="flex gap-4 mt-4">
                  {project.links && project.links[0] && (
                    <a
                      href={project.links[0]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-500 font-medium flex items-center gap-1 hover:text-orange-400 transition-colors duration-200"
                    >
                      Link 1
                      <ExternalLink size={16} />
                    </a>
                  )}
                  {project.links && project.links[1] && (
                    <a
                      href={project.links[1]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-500 font-medium flex items-center gap-1 hover:text-orange-400 transition-colors duration-200"
                    >
                      Link 2
                      <Github size={16} />
                    </a>
                  )}
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