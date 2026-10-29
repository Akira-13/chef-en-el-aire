import { Navigate, Route, Routes } from 'react-router';
import { InputLayer } from './input';
import { OutputLayer } from './output/OutputLayer';
import { ProfileScreen } from './profile/ProfileScreen';
import { CelebrationScreen } from './screens/CelebrationScreen';
import { CookingScreen } from './screens/CookingScreen';
import { HomeScreen } from './screens/HomeScreen';
import { RecipeScreen } from './screens/RecipeScreen';
import { useThemeFromProfile } from './theme/useThemeFromProfile';

export function App() {
  useThemeFromProfile();
  return (
    <>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/receta/:recipeId" element={<RecipeScreen />} />
        <Route path="/cocinar/:recipeId" element={<CookingScreen />} />
        <Route path="/listo/:recipeId" element={<CelebrationScreen />} />
        <Route path="/perfil" element={<ProfileScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InputLayer />
      <OutputLayer />
    </>
  );
}
