import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { ProjectList } from "@/pages/ProjectList";
import { ProjectDetail } from "@/pages/ProjectDetail";
import { NewProject } from "@/pages/NewProject";
import { GlobalRulesPage } from "@/pages/GlobalRulesPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<ProjectList />} />
          <Route path="/rules" element={<GlobalRulesPage />} />
          <Route path="/projects/new" element={<NewProject />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
