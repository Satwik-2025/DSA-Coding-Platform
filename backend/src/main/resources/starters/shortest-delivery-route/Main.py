import sys


def solve(n, edges):
    # Return the shortest total time from node 1 to node n, or -1 if n is unreachable.
    # Each edge is (u, v, w): a one-way road from u to v taking w minutes. Nodes are numbered 1..n.
    # TODO: write your algorithm here
    return -1


def main():
    data = sys.stdin.buffer.read().split()
    n, m = int(data[0]), int(data[1])
    edges = [(int(data[2 + 3 * i]), int(data[3 + 3 * i]), int(data[4 + 3 * i])) for i in range(m)]
    print(solve(n, edges))


main()
