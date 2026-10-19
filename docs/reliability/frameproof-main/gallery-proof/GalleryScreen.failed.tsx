/**
 * Gallery
 * Built by FlowCode from the app model; it reads and writes the app's one store (src/app/store.ts).
 */
import { ResourceIndex } from "../sections/ResourceIndex";
import { go } from "../app/routes";
import { store } from "../app/store";
import { useRecords } from "../sections/AppData";

export default function GalleryScreen() {
  const photos = useRecords("photo");
  const [searchTerm, setSearchTerm] = useState("");
  return (
  <ResourceIndex
    store={store}
    entity="photo"
    title="Gallery"
    onOpen={(id) => go("photo-detail", id)}
    search={searchTerm}
    onSearchChange={setSearchTerm}
  />
);
}
