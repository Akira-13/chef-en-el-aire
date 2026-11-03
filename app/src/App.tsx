import { Navigate, Route, Routes } from 'react-router';
import { TimerHost } from './cooking/TimerHost';
import { InputLayer } from './input';
import { OutputLayer } from './output/OutputLayer';
import { ProfileScreen } from './profile/ProfileScreen';
import { CelebrationScreen } from './screens/CelebrationScreen';
import { CookingScreen } from './screens/CookingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { isOnboarded } from './screens/onboardingState';
import { RecipeScreen } from './screens/RecipeScreen';
import { useThemeFromProfile } from './theme/useThemeFromProfile';
import { OfflineBanner } from './ui/OfflineBanner';

// Se evalúa en cada visita a la ruta: tras el recorrido inicial debe mostrar el inicio.
function HomeRoute() {
  return isOnboarded() ? <HomeScreen /> : <Navigate to="/bienvenida" replace />;
}

export function App() {
  useThemeFromProfile();
  return (
    <>
      <OfflineBanner />
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/bienvenida" element={<OnboardingScreen />} />
        <Route path="/receta/:recipeId" element={<RecipeScreen />} />
        <Route path="/cocinar/:recipeId" element={<CookingScreen />} />
        <Route path="/listo/:recipeId" element={<CelebrationScreen />} />
        <Route path="/perfil" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <TimerHost />
      <InputLayer />
      <OutputLayer />
    </>
  );
}
