import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { TimerHost } from './cooking/TimerHost';
import { InputLayer } from './input';
import { useCommands } from './core/commandBus';
import { output } from './core/services';
import { OutputLayer } from './output/OutputLayer';
import { CookingScreen } from './screens/CookingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { OnboardingScreen } from './screens/OnboardingScreen';
import { isOnboarded } from './screens/onboardingState';
import { RecipeScreen } from './screens/RecipeScreen';
import styles from './screens/screens.module.css';
import { useThemeFromProfile } from './theme/useThemeFromProfile';
import { OfflineBanner } from './ui/OfflineBanner';

// Pantallas que no se necesitan en el primer render: se descargan al visitarlas (RNF-10).
const CommunityScreen = lazy(() =>
  import('./community/CommunityScreen').then((module) => ({ default: module.CommunityScreen })),
);
const ProfileScreen = lazy(() =>
  import('./profile/ProfileScreen').then((module) => ({ default: module.ProfileScreen })),
);
const CelebrationScreen = lazy(() =>
  import('./screens/CelebrationScreen').then((module) => ({ default: module.CelebrationScreen })),
);

// Se evalúa en cada visita a la ruta: tras el recorrido inicial debe mostrar el inicio.
function HomeRoute() {
  return isOnboarded() ? <HomeScreen /> : <Navigate to="/bienvenida" replace />;
}

// Mientras se descarga una pantalla perezosa. role="status" lo anuncia al lector de pantalla.
function ScreenFallback() {
  return (
    <p role="status" className={styles.loading}>
      Cargando…
    </p>
  );
}

// Comando "abre la comunidad" (HU de la Comunidad). Vive aquí una sola vez para todas las
// pantallas. En la cocina no se navega, para no interrumpir la receta.
function OpenCommunityCommand() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useCommands(({ command }) => {
    if (command.type !== 'openCommunity') return;
    if (pathname.startsWith('/cocinar/')) {
      output.announce({ text: 'Termina o pausa la receta para abrir la Comunidad', kind: 'info' });
      return;
    }
    if (pathname !== '/comunidad') navigate('/comunidad');
  });

  return null;
}

export function App() {
  useThemeFromProfile();
  return (
    <>
      <OfflineBanner />
      <OpenCommunityCommand />
      <Suspense fallback={<ScreenFallback />}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/bienvenida" element={<OnboardingScreen />} />
          <Route path="/receta/:recipeId" element={<RecipeScreen />} />
          <Route path="/cocinar/:recipeId" element={<CookingScreen />} />
          <Route path="/listo/:recipeId" element={<CelebrationScreen />} />
          <Route path="/comunidad" element={<CommunityScreen />} />
          <Route path="/perfil" element={<ProfileScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <TimerHost />
      <InputLayer />
      <OutputLayer />
    </>
  );
}
