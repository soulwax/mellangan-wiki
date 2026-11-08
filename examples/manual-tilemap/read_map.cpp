#include <algorithm>
#include <fstream>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

enum class Ground { Grass, Stone, Water };

struct Cell {
  Ground ground = Ground::Grass;
  bool tree = false;
};

struct TileMap {
  int width = 0;
  int height = 0;
  int spawnX = -1;
  int spawnY = -1;
  std::vector<Cell> cells;

  const Cell &at(int x, int y) const {
    if (x < 0 || y < 0 || x >= width || y >= height)
      throw std::out_of_range("tile coordinate outside map");
    return cells.at(static_cast<std::size_t>(y * width + x));
  }
};

TileMap readMap(const std::string &path) {
  std::ifstream input(path);
  if (!input)
    throw std::runtime_error("cannot open " + path);

  TileMap map;
  std::string row;
  while (std::getline(input, row)) {
    if (!row.empty() && row.back() == '\r')
      row.pop_back(); // Also accept CRLF when read on a Unix-like system.
    if (row.empty())
      throw std::runtime_error("empty row at y=" + std::to_string(map.height));
    if (map.height == 0)
      map.width = static_cast<int>(row.size());
    if (static_cast<int>(row.size()) != map.width)
      throw std::runtime_error("unequal row width at y=" + std::to_string(map.height));

    for (int x = 0; x < map.width; ++x) {
      Cell cell;
      switch (row[static_cast<std::size_t>(x)]) {
      case '.': break;
      case '#': cell.ground = Ground::Stone; break;
      case '~': cell.ground = Ground::Water; break;
      case 'T': cell.tree = true; break;
      case '@':
        if (map.spawnX >= 0)
          throw std::runtime_error("more than one @ spawn");
        map.spawnX = x;
        map.spawnY = map.height;
        break;
      default:
        throw std::runtime_error("unknown symbol at (" + std::to_string(x) + "," +
                                 std::to_string(map.height) + ")");
      }
      map.cells.push_back(cell);
    }
    ++map.height;
  }
  if (input.bad())
    throw std::runtime_error("error while reading " + path);
  if (map.height == 0)
    throw std::runtime_error("map is empty");
  if (map.spawnX < 0)
    throw std::runtime_error("map has no @ spawn");
  return map;
}

int main(int argc, char **argv) {
  if (argc != 2) {
    std::cerr << "usage: read_map <manual_map.txt>\n";
    return 1;
  }
  try {
    const TileMap map = readMap(argv[1]);
    const int water = static_cast<int>(std::count_if(
        map.cells.begin(), map.cells.end(),
        [](const Cell &cell) { return cell.ground == Ground::Water; }));
    std::cout << "size: " << map.width << " x " << map.height << '\n';
    std::cout << "spawn: (" << map.spawnX << ", " << map.spawnY << ")\n";
    std::cout << "water cells: " << water << '\n';
    std::cout << "tree at (7, 3): " << (map.at(7, 3).tree ? "yes" : "no") << '\n';
    std::cout << "spawn ground is grass: "
              << (map.at(map.spawnX, map.spawnY).ground == Ground::Grass ? "yes" : "no")
              << '\n';
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
