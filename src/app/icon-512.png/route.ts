import { brandIcon } from '@/lib/app-icon';

// Grande icône pour l'installation sur Android (référencée par les manifestes).
export function GET() {
  return brandIcon(512);
}
