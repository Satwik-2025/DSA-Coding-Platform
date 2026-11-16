import sys


class ListNode:
    def __init__(self, val, next=None):
        self.val = val
        self.next = next


def solve(head, k):
    # Reverse every complete group of k nodes in place and return the new head.
    # TODO: write your algorithm here
    return head


def main():
    data = sys.stdin.buffer.read().split()
    n, k = int(data[0]), int(data[1])
    dummy = tail = ListNode(0)
    for x in data[2:2 + n]:
        tail.next = ListNode(int(x))
        tail = tail.next
    node = solve(dummy.next, k)
    parts = []
    # Stop after n nodes: a mistake that leaves a cycle would otherwise print forever.
    for _ in range(n):
        if node is None:
            break
        parts.append(f"{node.val} -> ")
        node = node.next
    print("".join(parts) + "null" if node is None else "ERROR: more nodes than the input had (cycle?)")


main()
