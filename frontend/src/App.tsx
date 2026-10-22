import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { DatasetPage } from './pages/Dataset';
import { TimetablePage } from './pages/Timetable';
import { ClusterLabPage } from './pages/ClusterLab';
import { BenchmarksPage } from './pages/Benchmarks';
import { BenchmarksPrintPage } from './pages/BenchmarksPrint';
import { DesignPage } from './pages/Design';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Printable view without app chrome */}
        <Route path="/benchmarks/print" element={<BenchmarksPrintPage />} />

        {/* Main Application with 56px left rail and 40px top bar */}
        <Route element={<AppShell />}>
          <Route path="/" element={<DatasetPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/clusters" element={<ClusterLabPage />} />
          <Route path="/benchmarks" element={<BenchmarksPage />} />
          <Route path="/design" element={<DesignPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
